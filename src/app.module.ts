import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration, validateEnvironment } from './config/configuration';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ContributorsModule } from './modules/contributors/contributors.module';
import { ThriftModule } from './modules/thrift/thrift.module';
import { correlationIdMiddleware } from './shared/presentation/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    HealthModule,
    IdentityModule,
    AgentsModule,
    ContributorsModule,
    ThriftModule,
  ],
  providers: [
    {
      provide: 'APP_CONFIG',
      inject: [configuration.KEY],
      useFactory: (config: ReturnType<typeof configuration>): ReturnType<typeof configuration> => config,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(correlationIdMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
