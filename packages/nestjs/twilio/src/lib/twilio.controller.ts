import { Controller, UseGuards, Get, Req, Inject, Query, Post, Param, Put, HttpStatus, Body, ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { Auth0Guard } from '@/src/app/api/middleware/auth0/auth0.guard';
import { TwilioUserService } from './twilio.user.service';
import { AccountAuthorizedRequest } from '../../api';
import { RegistrationGuard } from '@/src/app/common/guards/registration.guard';
import { TwilioUserAccessToken } from './twilio';

export class TwilioUserInfo {
  token: TwilioUserAccessToken;  
}

/**
 * Twilio controller responsible for retrieving client tokens.
 * 
 * @deprecated
 */
@Controller('twilio')
@UseGuards(Auth0Guard, RegistrationGuard)
export class TwilioController {

  constructor(@Inject(TwilioUserService) private readonly zoomUserService: TwilioUserService) { }

  /*
  @Get('info')
  @UseInterceptors(ClassSerializerInterceptor)
  getTwilioAccessToken(@Req() req: AccountAuthorizedRequest): TwilioUserInfo {
    return {
      token: this.zoomUserService.forUser(req.user.user).makeAccessToken()
    };
  }
  */

}
