import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Patch, Post,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.authService.updateProfile(user.id, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
          callback(new BadRequestException('Only PNG, JPEG, or WebP images are allowed.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthUser) {
    return this.authService.uploadAvatar(user.id, file);
  }
}
