import { Module } from "@nestjs/common";
import { ProfileModule } from "./profile";

@Module({
  imports: [ProfileModule],
  exports: [ProfileModule]
})
export class AppModelModule { }
