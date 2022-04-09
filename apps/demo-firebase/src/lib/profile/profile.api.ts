import { Expose } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SetProfileUsernameParams {

  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  username!: string;

  // MARK: Admin Only
  /**
   * Sets the target profile. If not defined, assumes the current user's profile
   */
  @Expose()
  @IsString()
  @IsOptional()
  profile?: string;

}
