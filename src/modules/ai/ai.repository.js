const prisma = require("../../config/prisma");

function createChatSession(userId, data) {
  return prisma.chatSession.create({
    data: {
      userId,
      title: data.title || null,
      context: data.context || null,
      metadata: data.metadata || null,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

function listChatSessions(userId) {
  return prisma.chatSession.findMany({
    where: { userId },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });
}

function findChatSessionById(sessionId) {
  return prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

function createChatMessage(sessionId, data) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role: data.role,
      content: data.content,
      metadata: data.metadata || null,
      tokens: data.tokens || null,
    },
  });
}

function getRecentMessages(sessionId, { limit = 10 } = {}) {
  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

function updateChatSession(sessionId, data) {
  return prisma.chatSession.update({
    where: { id: sessionId },
    data,
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

function createReportJob(data) {
  return prisma.reportJob.create({
    data,
  });
}

function updateReportJob(jobId, data) {
  return prisma.reportJob.update({
    where: { id: jobId },
    data,
    include: {
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          email: true,
        },
      },
    },
  });
}

function findReportJobById(jobId) {
  return prisma.reportJob.findUnique({
    where: { id: jobId },
    include: {
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          email: true,
        },
      },
    },
  });
}

function listReportJobs(where) {
  return prisma.reportJob.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          email: true,
        },
      },
    },
  });
}

module.exports = {
  createChatSession,
  listChatSessions,
  findChatSessionById,
  createChatMessage,
  getRecentMessages,
  updateChatSession,
  createReportJob,
  updateReportJob,
  findReportJobById,
  listReportJobs,
};
