import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthService {
    getContract() {
        return {
            dashboardAuth: {
                type: "session",
                status: "planned",
            },
            projectApiAuth: {
                type: "bearer_api_key",
                status: "active_design",
            },
        };
    }
}