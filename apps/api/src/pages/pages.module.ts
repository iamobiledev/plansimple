import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { PagesService } from "./pages.service";
import { PagesController } from "./pages.controller";

@Module({
  imports: [OrgsModule],
  providers: [PagesService],
  controllers: [PagesController],
  exports: [PagesService],
})
export class PagesModule {}
