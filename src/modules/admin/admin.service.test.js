const adminService = require('./admin.service');
const prisma = require('../../config/prisma');
const notificationService = require('../notifications/notification.service');
const adminRepository = require('./admin.repository');
const ApiError = require('../../utils/apiError');

jest.mock('../../config/prisma', () => ({
  sample: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
  createNotification: jest.fn(),
}));

jest.mock('./admin.repository', () => ({
  getUserById: jest.fn(),
  createAuditLog: jest.fn(),
}));

describe('Admin Service - Notifications & Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('notifyUser', () => {
    it('should create a notification and an audit log successfully', async () => {
      adminRepository.getUserById.mockResolvedValueOnce({ id: 'user-1' });
      notificationService.createNotification.mockResolvedValueOnce({ id: 'note-1' });
      adminRepository.createAuditLog.mockResolvedValueOnce({});

      const payload = { title: 'Test Title', message: 'Test Message', type: 'GENERAL' };
      const actorId = 'admin-1';

      const result = await adminService.notifyUser('user-1', payload, actorId);

      expect(result).toHaveProperty('id', 'note-1');
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          title: 'Test Title',
          message: 'Test Message',
        })
      );
      expect(adminRepository.createAuditLog).toHaveBeenCalled();
    });

    it('should throw an ApiError if the target user does not exist', async () => {
      adminRepository.getUserById.mockResolvedValueOnce(null);

      await expect(
        adminService.notifyUser('missing-user', { title: 'T', message: 'M' }, 'admin-1')
      ).rejects.toThrow(ApiError);
    });
  });

  describe('reverifySample', () => {
    it('should throw an ApiError if sample does not exist', async () => {
      prisma.sample.findUnique.mockResolvedValueOnce(null);

      await expect(
        adminService.reverifySample('missing-sample', { message: 'M' }, 'admin-1')
      ).rejects.toThrow(ApiError);
    });

    it('should use a transaction to update the sample and create a notification atomically', async () => {
      const mockSample = { id: 'sample-1', artisanId: 'artisan-1' };
      prisma.sample.findUnique.mockResolvedValueOnce(mockSample);
      
      const mockTx = {
        sample: { update: jest.fn().mockResolvedValue({ id: 'sample-1', status: 'MORE_INFO_REQUESTED' }) },
        notification: { create: jest.fn() }
      };
      
      // Simulate transaction callback execution
      prisma.$transaction.mockImplementationOnce(async (cb) => cb(mockTx));

      const payload = { message: 'Fix the photo.' };
      const result = await adminService.reverifySample('sample-1', payload, 'admin-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.sample.update).toHaveBeenCalledWith({
        where: { id: 'sample-1' },
        data: { status: 'MORE_INFO_REQUESTED' }
      });
      expect(mockTx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'artisan-1',
          message: 'Fix the photo.',
          type: 'GENERAL'
        })
      });
      expect(adminRepository.createAuditLog).toHaveBeenCalled();
      expect(result).toHaveProperty('status', 'MORE_INFO_REQUESTED');
    });
  });
});
