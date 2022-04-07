import { ProfileRole } from './profile.role';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SetProfileUsernameParams {

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  username!: string;

  // MARK: Admin Only
  /**
   * Sets the target profile. If not defined, assumes the current profile.
   */
  @IsString()
  @IsOptional({
    groups: [ProfileRole.SYS_ADMIN]
  })
  targetProfile?: string;

}
