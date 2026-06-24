import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedUserRequest } from "../common/interfaces/authenticated-user-request";
import { UserSessionGuard } from "../common/guards/user-session/user-session.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get("contract")
    getContract() {
        return this.authService.getContract();
    }

    @Post("register")
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post("login")
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @UseGuards(UserSessionGuard)
    @Get("me")
    me(@Req() request: AuthenticatedUserRequest) {
        return this.authService.me(request.authUserId);
    }
}