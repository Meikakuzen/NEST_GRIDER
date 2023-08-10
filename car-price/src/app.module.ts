import { Module, MiddlewareConsumer } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import {TypeOrmModule} from "@nestjs/typeorm"
import { User } from './users/entities/user.entity';
import { Report } from './reports/entities/report.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
const cookieSession = require('cookie-session');

@Module({
  imports: [UsersModule, ReportsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`
    }),

   // TypeOrmModule.forRoot()

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService)=>{
        return {
          type: 'sqlite',
          database: config.get<string>('DB_NAME'),
          entities: [User, Report],
          synchronize: true 
          }
      }
  })
],
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor(private configService: ConfigService){}

  configure(consumer: MiddlewareConsumer){
    consumer
      .apply(
        cookieSession({
          keys:[this.configService.get('COOKIE_KEY')]
        }),
      )
      .forRoutes('*')
  }
}
