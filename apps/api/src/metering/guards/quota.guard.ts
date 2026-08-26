import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { QuotaService } from "../quota.service";

@Injectable()
export class QuotaGuard implements CanActivate {
    constructor(private readonly quotaService: QuotaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const projectId =
            request.authProjectId || request.params?.projectId || request.params?.id || request.body?.projectId;

        if (!projectId) {
            return true;
        }

        const check = await this.quotaService.checkEnqueueQuota(projectId);

        if (!check.allowed) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.PAYMENT_REQUIRED,
                    error: "QUOTA_EXCEEDED",
                    message: check.reason || "Monthly quota exceeded. Please upgrade your subscription plan.",
                    current: check.current,
                    limit: check.limit,
                },
                HttpStatus.PAYMENT_REQUIRED,
            );
        }

        return true;
    }
}
