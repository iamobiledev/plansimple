import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { BillingController, SsoController } from "./billing.controller";

@Module({
  imports: [OrgsModule],
  controllers: [BillingController, SsoController],
})
export class BillingModule {}
