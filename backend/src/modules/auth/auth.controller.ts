import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@prisma/client';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.emailOrPhone, dto.password);
  }

  @Public()
  @Post('validate-invite')
  async validateInvite(@Body() dto: { token: string }) {
    return this.auth.validateInviteToken(dto.token);
  }

  @Public()
  @Post('set-password')
  async setPassword(@Body() dto: SetPasswordDto) {
    return this.auth.setPasswordFromInvite(dto.token, dto.password, dto.confirmPassword);
  }

  @Public()
  @Post('partner-login')
  async partnerLogin(@Body() dto: LoginDto) {
    return this.auth.partnerLogin(dto.emailOrPhone, dto.password);
  }

  @Public()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtpAfterSignup(dto.phone, dto.code);
  }

  @Public()
  @Post('login/request-otp')
  async requestLoginOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestLoginOtp(dto.phone);
  }

  @Public()
  @Post('login/verify-otp')
  async loginVerifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtpAndLogin(dto.phone, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async me(@Body() _body: Record<string, never>) {
    return { message: 'Use JWT to get user from guard' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout/request-otp')
  async requestCheckoutOtp(@CurrentUser() user: User) {
    return this.auth.requestCheckoutOtp(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout/verify-otp')
  async verifyCheckoutOtp(@CurrentUser() user: User, @Body() dto: VerifyOtpDto) {
    return this.auth.verifyCheckoutOtp(user.id, dto.phone, dto.code);
  }
}
