import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { AuthenticatedUserRequest } from "../common/interfaces/authenticated-user-request";
import { UserSessionGuard } from "../common/guards/user-session/user-session.guard";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

const AUTH_ROUTE_THROTTLE = {
    default: {
        limit: () => Number(process.env.AUTH_THROTTLE_LIMIT ?? 10),
        ttl: () => Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60_000),
    },
};

const PASSWORD_RESET_THROTTLE = {
    default: {
        limit: () => Number(process.env.PASSWORD_RESET_THROTTLE_LIMIT ?? 3),
        ttl: () => Number(process.env.PASSWORD_RESET_THROTTLE_TTL_MS ?? 900_000),
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

    @ApiOperation({ summary: "Request a password reset link sent to the user email." })
    @Throttle(PASSWORD_RESET_THROTTLE)
    @HttpCode(HttpStatus.OK)
    @Post("forgot-password")
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @ApiOperation({ summary: "Reset password using a valid 15-minute reset token." })
    @Throttle(AUTH_ROUTE_THROTTLE)
    @HttpCode(HttpStatus.OK)
    @Post("reset-password")
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @ApiOperation({ summary: "Verify user email using verification token." })
    @Throttle(AUTH_ROUTE_THROTTLE)
    @HttpCode(HttpStatus.OK)
    @Post("verify-email")
    verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto);
    }

    @ApiBearerAuth(SESSION_TOKEN_SECURITY)
    @ApiOperation({ summary: "Resend email verification link for the authenticated user." })
    @UseGuards(UserSessionGuard)
    @Throttle(AUTH_ROUTE_THROTTLE)
    @HttpCode(HttpStatus.OK)
    @Post("resend-verification")
    resendVerification(@Req() request: AuthenticatedUserRequest) {
        return this.authService.sendVerificationEmailForUser(request.authUserId);
    }

    @ApiBearerAuth(SESSION_TOKEN_SECURITY)
    @ApiOperation({ summary: "Return the current user and their organization memberships." })
    @UseGuards(UserSessionGuard)
    @Get("me")
    me(@Req() request: AuthenticatedUserRequest) {
        return this.authService.me(request.authUserId);
    }
}
