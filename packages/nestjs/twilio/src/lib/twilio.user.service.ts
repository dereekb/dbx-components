import { BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { UserDocument, UserService } from '../model/user';
import { TwilioApi } from './twilio.api';
import { TwilioUserAccessToken } from './twilio';

export class TwilioUserServiceInstance {

  constructor(public readonly user: UserDocument, private readonly twilioUserService: TwilioUserService) { }

  makeAccessToken(): TwilioUserAccessToken {
    const identity = this.user.id;
    const accessToken = this.twilioUserService.twilioApi.makeAccessToken({ identity, chat: true });
    return accessToken.toJwt();
  }

}

@Injectable()
export class TwilioUserService {

  constructor(@Inject(TwilioApi) public readonly twilioApi: TwilioApi, @Inject(UserService) public readonly userService: UserService) { }

  /**
   * Creates a new TwilioUserServiceInstance for the input user.
   */
  forUser(user: UserDocument): TwilioUserServiceInstance {
    return new TwilioUserServiceInstance(user, this);
  }

}
