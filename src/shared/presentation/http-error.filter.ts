import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../application/errors/domain-error';
import { IdentityApplicationError } from '../../modules/identity/application/identity-errors';
import { AgentApplicationError } from '../../modules/agents/application/agent-errors';
import { ContributorApplicationError } from '../../modules/contributors/application/contributor-errors';
import { ContributionApplicationError } from '../../modules/thrift/application/contribution-errors';

interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly correlation_id: string;
    readonly field_errors?: readonly unknown[];
  };
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const correlationId = String(response.getHeader('X-Correlation-Id') ?? 'unknown');

    const result = this.toError(exception, correlationId);
    response.status(result.status).json(result.body);
    void request;
  }

  private toError(exception: unknown, correlationId: string): {
    readonly status: number;
    readonly body: ErrorBody;
  } {
    if (exception instanceof DomainError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          error: { code: exception.code, message: exception.message, correlation_id: correlationId },
        },
      };
    }

    if (exception instanceof IdentityApplicationError) {
      const status = identityErrorStatus(exception.code);
      return {
        status,
        body: {
          error: { code: exception.code, message: exception.message, correlation_id: correlationId },
        },
      };
    }

    if (exception instanceof AgentApplicationError) {
      return {
        status: agentErrorStatus(exception.code),
        body: { error: { code: exception.code, message: exception.message, correlation_id: correlationId } },
      };
    }

    if (exception instanceof ContributorApplicationError) {
      return {
        status: contributorErrorStatus(exception.code),
        body: { error: { code: exception.code, message: exception.message, correlation_id: correlationId } },
      };
    }

    if (exception instanceof ContributionApplicationError) {
      return {
        status: contributionErrorStatus(exception.code),
        body: { error: { code: exception.code, message: exception.message, correlation_id: correlationId } },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        body: {
          error: {
            code: status === HttpStatus.BAD_REQUEST ? 'validation_failed' : 'http_error',
            message: status >= 500 ? 'The request could not be completed' : exception.message,
            correlation_id: correlationId,
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'internal_error',
          message: 'The request could not be completed',
          correlation_id: correlationId,
        },
      },
    };
  }
}

function agentErrorStatus(code: AgentApplicationError['code']): HttpStatus {
  if (code === 'agent_not_found') return HttpStatus.NOT_FOUND;
  if (code === 'agent_conflict' || code === 'agent_identifier_exists' || code === 'agent_assignment_conflict') return HttpStatus.CONFLICT;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

function contributorErrorStatus(code: ContributorApplicationError['code']): HttpStatus {
  if (code === 'contributor_not_found') return HttpStatus.NOT_FOUND;
  if (code === 'contributor_conflict' || code === 'contributor_identifier_exists' || code === 'assignment_conflict' || code === 'plan_overlap') return HttpStatus.CONFLICT;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

function contributionErrorStatus(code: string): HttpStatus {
  if (code === 'contributor_not_found' || code === 'obligation_not_found' || code === 'agent_not_found') return HttpStatus.NOT_FOUND;
  if (code === 'concurrent_update') return HttpStatus.CONFLICT;
  if (code === 'assignment_required' || code === 'agent_scope_violation') return HttpStatus.FORBIDDEN;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

function identityErrorStatus(code: IdentityApplicationError['code']): HttpStatus {
  if (code === 'invalid_credentials' || code === 'invalid_refresh_token' || code === 'invalid_mfa') {
    return HttpStatus.UNAUTHORIZED;
  }
  if (code === 'account_disabled' || code === 'email_not_verified' || code === 'mfa_required') {
    return HttpStatus.FORBIDDEN;
  }
  if (code === 'session_limit_reached') return HttpStatus.CONFLICT;
  if (code === 'identity_already_exists') return HttpStatus.CONFLICT;
  if (code === 'rate_limited') return HttpStatus.TOO_MANY_REQUESTS;
  if (code === 'refresh_token_reuse_detected') return HttpStatus.UNAUTHORIZED;
  if (code === 'session_not_found') return HttpStatus.NOT_FOUND;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}
