import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AlertController, ToastController } from '@ionic/angular';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let toastCtrlSpy: jasmine.SpyObj<ToastController>;
  let alertCtrlSpy: jasmine.SpyObj<AlertController>;

  beforeEach(() => {
    toastCtrlSpy = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastCtrlSpy.create.and.resolveTo({
      present: jasmine.createSpy('present').and.resolveTo(),
    } as unknown as HTMLIonToastElement);

    alertCtrlSpy = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    alertCtrlSpy.create.and.resolveTo({
      present: jasmine.createSpy('present').and.resolveTo(),
    } as unknown as HTMLIonAlertElement);

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastController, useValue: toastCtrlSpy },
        { provide: AlertController, useValue: alertCtrlSpy },
      ],
    });

    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate fixed reminder offset properly', () => {
    const futureStart = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const notifyAt = service.calcNotificationTime(futureStart.toISOString(), '60');

    expect(notifyAt).not.toBeNull();
    expect(futureStart.getTime() - (notifyAt as Date).getTime()).toBe(60 * 60 * 1000);
  });

  it('should request permission on session creation when browser permission is default', async () => {
    spyOn(service, 'isNative').and.returnValue(false);
    spyOn(service, 'needsIosHomeScreenInstall').and.returnValue(false);
    spyOn(service, 'isWebPushSupported').and.returnValue(true);
    spyOn(service, 'subscribeToPush').and.resolveTo(true);

    const originalNotification = (window as unknown as { Notification: unknown }).Notification;
    const requestPermissionSpy = jasmine.createSpy('requestPermission').and.resolveTo('granted');

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: requestPermissionSpy,
      },
    });

    try {
      const result = await service.ensureAccessForSessionCreation();
      expect(requestPermissionSpy).toHaveBeenCalledTimes(1);
      expect(service.subscribeToPush).toHaveBeenCalledTimes(1);
      expect(result).toBe('granted');
    } finally {
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: originalNotification,
      });
    }
  });
});
