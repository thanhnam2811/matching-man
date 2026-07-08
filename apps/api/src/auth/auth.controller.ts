import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { AuthenticatedUserRequest } from "../common/interfaces/authenticated-user-request";
import { UserSessionGuard } from "../common/guards/user-session/user-session.guard";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

// Keep these two literals in sync with AUTH_THROTTLE_LIMIT / AUTH_THROTTLE_TTL_MS's
// defaults in src/config/env.validation.ts — @Throttle() is evaluated at decoration
// time, so it can't read ConfigService.
const AUTH_ROUTE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

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
