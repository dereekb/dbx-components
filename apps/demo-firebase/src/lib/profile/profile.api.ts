import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SetProfileUsernameParams {

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  username!: string;

  // MARK: Admin Only
  /**
   * Sets the target profile. If not defined, assumes the current user's profile
   */
  @IsString()
  @IsOptional()
  profile?: string;

}
