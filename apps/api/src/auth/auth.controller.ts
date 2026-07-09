import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { AuthenticatedUserRequest } from "../common/interfaces/authenticated-user-request";
import { UserSessionGuard } from "../common/guards/user-session/user-session.guard";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

// @Throttle() is evaluated at decoration time (module load), before ConfigService
// exists, so a plain object literal here can't read config. @nestjs/throttler
// resolves limit/ttl lazily per-request when given a function (ThrottlerGuard#resolveValue),
// so read AUTH_THROTTLE_LIMIT / AUTH_THROTTLE_TTL_MS straight from process.env at
// that point instead — defaults match src/config/env.validation.ts.
const AUTH_ROUTE_THROTTLE = {
    default: {
        limit: () => Number(process.env.AUTH_THROTTLE_LIMIT ?? 10),
        ttl: () => Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60_000),
    },
};

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @ApiOperation({ summary: "Return the dashboard API contract (routes and auth schemes)." })
    @Get("contract")
    getContract() {
        return this.authService.getContract();
    }

    @ApiOperation({ summary: "Register a user, seed a personal organization, and return a session token." })
    @Throttle(AUTH_ROUTE_THROTTLE)
    @Post("register")
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @ApiOperation({ summary: "Verify credentials and return a session token." })
    @Throttle(AUTH_ROUTE_THROTTLE)
    @Post("login")
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @ApiBearerAuth(SESSION_TOKEN_SECURITY)
    @ApiOperation({ summary: "Return the current user and their organization memberships." })
    @UseGuards(UserSessionGuard)
    @Get("me")
    me(@Req() request: AuthenticatedUserRequest) {
        return this.authService.me(request.authUserId);
    }
}
