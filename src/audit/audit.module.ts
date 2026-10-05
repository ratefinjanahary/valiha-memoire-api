import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';

/**
 * @Global() permet à AuditService d'être injecté dans n'importe quel module
 * sans avoir à réimporter AuditModule partout.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
