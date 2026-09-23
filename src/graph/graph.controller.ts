import { Controller, Get } from '@nestjs/common';
import { GraphService } from './graph.service.js';

@Controller('api/graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('data')
  async getGraphData() {
    return this.graphService.getGraphData();
  }
}
