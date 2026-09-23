import { Module } from '@nestjs/common';
import { MemoireService } from './memoire.service.js';
import { MemoireController } from './memoire.controller.js';
import { SearchModule } from '../search/search.module.js';

@Module({
  imports: [SearchModule],
  providers: [MemoireService],
  controllers: [MemoireController],
})
export class MemoireModule {}
