import { ProfileRole } from './profile.role';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SetProfileUsernameParams {

  @IsString()
  @IsOptional()
  profile?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  username!: string;

  // MARK: Admin Only
  /**
   * Sets the target profile. If not defined, assumes the current profile.
   */
}
