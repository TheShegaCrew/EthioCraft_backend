const authService = require('../auth.service');
const authRepository = require('../auth.repository');
const mailer = require('../../../utils/mailer');
const ApiError = require('../../../utils/apiError');

jest.mock('../auth.repository');
jest.mock('../../../utils/mailer');

describe('auth.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registerUser - successful issues verification OTP', async () => {
    const payload = { firstName: 'A', lastName: 'B', email: 'a@example.com', password: 'password123', role: 'CUSTOMER' };
    authRepository.findAuthUserByEmail.mockResolvedValue(null);
    authRepository.createUser.mockResolvedValue({ id: 'u1', email: payload.email });
    authRepository.upsertEmailOtp.mockResolvedValue(true);
    mailer.sendOtpEmail.mockResolvedValue(true);

    const res = await authService.registerUser(payload);

    expect(authRepository.findAuthUserByEmail).toHaveBeenCalledWith(payload.email);
    expect(res.user).toBeDefined();
    expect(res.requiresEmailVerification).toBe(true);
  });

  test('registerUser - duplicate email throws', async () => {
    const payload = { firstName: 'A', lastName: 'B', email: 'a@example.com', password: 'password123', role: 'CUSTOMER' };
    authRepository.findAuthUserByEmail.mockResolvedValue({ id: 'u1' });

    await expect(authService.registerUser(payload)).rejects.toThrow(ApiError);
  });

  test('loginUser - success returns token and user', async () => {
    const payload = { email: 'a@example.com', password: 'password123' };
    const passwordHash = await require('bcryptjs').hash(payload.password, 12);
    authRepository.findAuthUserByEmail.mockResolvedValue({ id: 'u1', passwordHash, status: 'ACTIVE', isEmailVerified: true });
    authRepository.findPublicUserById.mockResolvedValue({ id: 'u1', email: payload.email, role: 'CUSTOMER' });

    const res = await authService.loginUser(payload);

    expect(res.user).toBeDefined();
    expect(res.token).toBeDefined();
  });

  test('loginUser - wrong password', async () => {
    const payload = { email: 'a@example.com', password: 'wrongpass' };
    const passwordHash = await require('bcryptjs').hash('password123', 12);
    authRepository.findAuthUserByEmail.mockResolvedValue({ id: 'u1', passwordHash, status: 'ACTIVE', isEmailVerified: true });

    await expect(authService.loginUser(payload)).rejects.toThrow(ApiError);
  });

  test('verifyOtp - success returns token', async () => {
    const payload = { email: 'a@example.com', code: '123456' };
    const user = { id: 'u1', email: payload.email, firstName: 'A' };
    authRepository.findAuthUserByEmail.mockResolvedValue(user);
    const codeHash = require('crypto').createHash('sha256').update(payload.code).digest('hex');
    authRepository.findEmailOtp.mockResolvedValue({ id: 'otp1', codeHash, expiresAt: new Date(Date.now() + 10000), attempts: 0 });
    authRepository.deleteEmailOtpById.mockResolvedValue(true);
    authRepository.markUserEmailVerified.mockResolvedValue({ id: 'u1', email: payload.email });

    const res = await authService.verifyOtp(payload);
    expect(res.token).toBeDefined();
  });

  test('forgotPassword - non existing email returns generic message', async () => {
    const payload = { email: 'nope@example.com' };
    authRepository.findAuthUserByEmail.mockResolvedValue(null);

    const res = await authService.forgotPassword(payload);
    expect(res.message).toMatch(/If the email exists/);
  });

  test('resetPassword - success updates password', async () => {
    const payload = { email: 'a@example.com', otp: '654321', newPassword: 'newpass123' };
    const user = { id: 'u1', email: payload.email };
    authRepository.findAuthUserByEmail.mockResolvedValue(user);
    const codeHash = require('crypto').createHash('sha256').update(payload.otp).digest('hex');
    authRepository.findEmailOtp.mockResolvedValue({ id: 'otp1', codeHash, expiresAt: new Date(Date.now() + 10000), attempts: 0 });
    authRepository.updateUserPassword.mockResolvedValue(true);
    authRepository.deleteEmailOtpById.mockResolvedValue(true);

    const res = await authService.resetPassword(payload);
    expect(res.message).toMatch(/Password reset successfully/);
  });
});
