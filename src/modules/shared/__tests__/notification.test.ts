import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { getFirebaseMessaging } from '../../../config/firebase';
import { logDeveloper } from '../../../utils/logger';
import { notificationRepository } from '../notification.repository';
import { notificationService } from '../notification.service';

jest.mock('../notification.repository', () => ({
  notificationRepository: {
    createNotification: jest.fn(),
    getUserDeviceToken: jest.fn(),
    findNotificationsByUserId: jest.fn(),
    markNotificationAsRead: jest.fn(),
    updateUserDeviceToken: jest.fn(),
  },
}));

jest.mock('../../../config/firebase', () => ({
  getFirebaseMessaging: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  ...jest.requireActual('../../../utils/logger'),
  logDeveloper: jest.fn(),
}));

const mockedRepo = notificationRepository as jest.Mocked<typeof notificationRepository>;
const mockedGetFirebaseMessaging = getFirebaseMessaging as jest.MockedFunction<typeof getFirebaseMessaging>;
const mockedLogDeveloper = logDeveloper as jest.MockedFunction<typeof logDeveloper>;

function authHeader(role: 'ADMIN' | 'MANAGER' | 'LEADER' | 'TECHNICAL', userId = 'user-1') {
  const token = jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function fakeNotification(overrides: Record<string, unknown> = {}) {
  return {
    notificationId: 'noti-1',
    userId: 'user-1',
    title: 'Test title',
    content: 'Test content',
    notificationType: 'SYSTEM',
    refType: null,
    refId: null,
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-07-23T00:00:00Z'),
    ...overrides,
  };
}

describe('notificationService.sendNotificationToUser', () => {
  const mockSend = jest.fn();

  beforeEach(() => {
    mockSend.mockReset();
    mockedGetFirebaseMessaging.mockReturnValue({ send: mockSend } as never);
  });

  it('creates the notification, logs the device token, and calls Firebase send() when the user has a deviceToken', async () => {
    mockedRepo.createNotification.mockResolvedValue(fakeNotification() as never);
    mockedRepo.getUserDeviceToken.mockResolvedValue({ deviceToken: 'device-token-abc' } as never);
    mockSend.mockResolvedValue('projects/x/messages/1');

    const result = await notificationService.sendNotificationToUser({
      userId: 'user-1',
      title: 'Test title',
      content: 'Test content',
    });

    expect(mockedRepo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', title: 'Test title', content: 'Test content' }),
    );
    expect(mockedLogDeveloper).toHaveBeenCalledWith('Device Token check', {
      userId: 'user-1',
      deviceToken: 'device-token-abc',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'device-token-abc',
        notification: { title: 'Test title', body: 'Test content' },
      }),
    );
    expect(result).toMatchObject({ notificationId: 'noti-1' });
  });

  it('creates the notification and logs the device token, but does not call Firebase send() when the user has no deviceToken (and does not throw)', async () => {
    mockedRepo.createNotification.mockResolvedValue(fakeNotification() as never);
    mockedRepo.getUserDeviceToken.mockResolvedValue({ deviceToken: null } as never);

    await expect(
      notificationService.sendNotificationToUser({
        userId: 'user-1',
        title: 'Test title',
        content: 'Test content',
      }),
    ).resolves.toMatchObject({ notificationId: 'noti-1' });

    expect(mockedRepo.createNotification).toHaveBeenCalledTimes(1);
    expect(mockedLogDeveloper).toHaveBeenCalledWith('Device Token check', { userId: 'user-1', deviceToken: null });
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockedGetFirebaseMessaging).not.toHaveBeenCalled();
  });
});

describe('notificationService.getUserNotifications', () => {
  it('returns the list of notifications for a user in the correct shape, ordered as returned by the repository', async () => {
    const notifications = [fakeNotification(), fakeNotification({ notificationId: 'noti-2', isRead: true })];
    mockedRepo.findNotificationsByUserId.mockResolvedValue(notifications as never);

    const result = await notificationService.getUserNotifications('user-1');

    expect(mockedRepo.findNotificationsByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ notificationId: 'noti-1', userId: 'user-1', title: 'Test title' });
    expect(result[1]).toMatchObject({ notificationId: 'noti-2', isRead: true });
  });
});

describe('notificationService.markAsRead', () => {
  it('marks the notification as read and forwards the id to the repository', async () => {
    mockedRepo.markNotificationAsRead.mockResolvedValue(
      fakeNotification({ isRead: true, readAt: new Date('2026-07-23T01:00:00Z') }) as never,
    );

    const result = await notificationService.markAsRead('noti-1');

    expect(mockedRepo.markNotificationAsRead).toHaveBeenCalledWith('noti-1');
    expect(result.isRead).toBe(true);
    expect(result.readAt).not.toBeNull();
  });
});

describe('notificationService.registerDeviceToken', () => {
  it('forwards the userId and deviceToken to the repository and returns the updated row', async () => {
    mockedRepo.updateUserDeviceToken.mockResolvedValue({ userId: 'user-1', deviceToken: 'real-fcm-token' } as never);

    const result = await notificationService.registerDeviceToken('user-1', 'real-fcm-token');

    expect(mockedRepo.updateUserDeviceToken).toHaveBeenCalledWith('user-1', 'real-fcm-token');
    expect(result).toMatchObject({ userId: 'user-1', deviceToken: 'real-fcm-token' });
  });
});

describe('HTTP routes', () => {
  it('POST /api/v1/notifications/test-send returns 201 and creates the notification', async () => {
    mockedRepo.createNotification.mockResolvedValue(fakeNotification() as never);
    mockedRepo.getUserDeviceToken.mockResolvedValue({ deviceToken: null } as never);

    const res = await request(app)
      .post('/api/v1/notifications/test-send')
      .set('Authorization', authHeader('ADMIN'))
      .send({ userId: 'user-1', title: 'Test title', content: 'Test content' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ notificationId: 'noti-1' });
  });

  it('POST /api/v1/notifications/test-send rejects a payload missing title with 400', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/test-send')
      .set('Authorization', authHeader('ADMIN'))
      .send({ userId: 'user-1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.createNotification).not.toHaveBeenCalled();
  });

  it('GET /api/v1/notifications returns 200 with the caller\'s notifications', async () => {
    mockedRepo.findNotificationsByUserId.mockResolvedValue([fakeNotification()] as never);

    const res = await request(app).get('/api/v1/notifications').set('Authorization', authHeader('ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockedRepo.findNotificationsByUserId).toHaveBeenCalledWith('user-1');
  });

  it('GET /api/v1/notifications rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
    expect(mockedRepo.findNotificationsByUserId).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/notifications/:id/read returns 200 with the updated notification', async () => {
    mockedRepo.markNotificationAsRead.mockResolvedValue(fakeNotification({ isRead: true }) as never);

    const res = await request(app)
      .patch('/api/v1/notifications/noti-1/read')
      .set('Authorization', authHeader('ADMIN'));

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
    expect(mockedRepo.markNotificationAsRead).toHaveBeenCalledWith('noti-1');
  });

  it('POST /api/v1/notifications/device-token registers the token for the authenticated user', async () => {
    mockedRepo.updateUserDeviceToken.mockResolvedValue({ userId: 'user-1', deviceToken: 'real-fcm-token' } as never);

    const res = await request(app)
      .post('/api/v1/notifications/device-token')
      .set('Authorization', authHeader('TECHNICAL'))
      .send({ deviceToken: 'real-fcm-token' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: 'user-1', deviceToken: 'real-fcm-token' });
    expect(mockedRepo.updateUserDeviceToken).toHaveBeenCalledWith('user-1', 'real-fcm-token');
  });

  it('POST /api/v1/notifications/device-token rejects an empty deviceToken with 400', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/device-token')
      .set('Authorization', authHeader('TECHNICAL'))
      .send({ deviceToken: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedRepo.updateUserDeviceToken).not.toHaveBeenCalled();
  });

  it('POST /api/v1/notifications/device-token rejects an unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/v1/notifications/device-token').send({ deviceToken: 'x' });
    expect(res.status).toBe(401);
    expect(mockedRepo.updateUserDeviceToken).not.toHaveBeenCalled();
  });
});
