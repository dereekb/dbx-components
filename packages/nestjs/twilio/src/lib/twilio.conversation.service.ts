import { Inject, Injectable } from '@nestjs/common';
import { ConversationContext } from 'twilio/lib/rest/conversations/v1/conversation';
import { ParticipantInstance } from 'twilio/lib/rest/conversations/v1/conversation/participant';
import { UserId } from '../model/user';
import { TwilioConversationSid, TwilioParticipant } from './twilio';
import { TwilioApi } from './twilio.api';


export class TwilioConversationServiceInstance {

  constructor(public readonly sid: TwilioConversationSid, private readonly service: TwilioConversationService) { }

  get conversation() {
    return this.service.conversations(this.sid);
  }

  async addParticipant(userId: UserId): Promise<ParticipantInstance> {
    return this.conversation.participants.create({
      identity: userId
    });
  }

  async removeParticipant(userId: UserId): Promise<boolean> {
    const participants = await this.loadParticipants();
    const participant = participants.find((x) => x.identity === userId);
    return (participant) ? participant.remove() : true;
  }

  async loadParticipants(): Promise<ParticipantInstance[]> {
    return this.conversation.participants.list({});
  }

}

/**
 * Service for interacting with the conversation api.
 */
@Injectable()
export class TwilioConversationService {

  constructor(@Inject(TwilioApi) public readonly twilioApi: TwilioApi) { }

  get conversations() {
    return this.twilioApi.client.conversations.conversations;
  }

  async createConversation(): Promise<TwilioConversationServiceInstance> {
    const conversation = await this.conversations.create({
      messagingServiceSid: this.twilioApi.messagingServiceSid
    });

    return this.forConversation(conversation.sid);
  }

  forConversation(conversationSid: TwilioConversationSid) {
    return new TwilioConversationServiceInstance(conversationSid, this);
  }

}
