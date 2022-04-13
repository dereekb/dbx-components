import { Profile } from './profile';
import { Expose } from "class-transformer";
import { FirebaseFunctionMap, FirebaseFunctionMapFactory, firebaseFunctionMapFactory, FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap } from "@dereekb/firebase";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SetProfileUsernameParams {

  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  username!: string;

  // MARK: Admin Only
  /**
   * Sets the target profile/user. If not defined, assumes the current user's profile.
   */
  @Expose()
  @IsString()
  @IsOptional()
  uid?: string;

}

/**
 * We set the key here to allow both the functions server and the type map/client access this shared key.
 */
export const profileSetUsernameKey = 'profileSetUsername';

/**
 * This is our FirebaseFunctionTypeMap for Profile. It defines all the functions that are available.
 */
export type ProfileFunctionTypeMap = {
  [profileSetUsernameKey]: [SetProfileUsernameParams, Profile]
}

/**
 * This is the configuration map. It is 
 */
export const profileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ProfileFunctionTypeMap> = {
  [profileSetUsernameKey]: null
}

/**
 * Declared as an abstract class so we can inject it into our Angular app using this token.
 */
// ignore to prevent having to re-implement all function map types. We only want to use this as an Angular token without importing InjectionToken.
// @ts-ignore
export abstract class ProfileFunctions implements FirebaseFunctionMap<ProfileFunctionTypeMap> { }

/**
 * Used to generate our ProfileFunctionMap for a Functions instance.
 */
export const profileFunctionMap = firebaseFunctionMapFactory(profileFunctionTypeConfigMap);
