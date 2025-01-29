import { Module } from '@nestjs/common';
import { notificationInitServerActions, NotificationInitServerActions } from './notification.action.init.server';
import { notificationServerActions, NotificationServerActions } from './notification.action.server';
import { NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN } from './notification.config';
import { NotificationTemplateService } from './notification.config.service';

// TODO: ...

export class NotificationModule {}
