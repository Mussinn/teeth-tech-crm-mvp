package identity

import (
	"context"
	"errors"
	"strings"
)

// RecordAuthAudit is independent of the auth transaction, as Java's REQUIRES_NEW
// audit is. It never stores passwords, request bodies, or raw tokens.
func (s *Service) RecordAuthAudit(ctx context.Context, action, path, requestID, ip string, actor User, operationError error) error {
	var failureCode *string
	if operationError != nil {
		code := "InternalError"
		var failure *Failure
		if errors.As(operationError, &failure) {
			switch {
			case failure == InvalidRefresh:
				code = "InvalidRefreshSessionException"
			case failure == Inactive:
				code = "AccountUnavailableException"
			case failure.Code == "ENT_001":
				code = "UserNotFoundException"
			case failure.Message == "Не правильный пароль":
				code = "InvalidPasswordException"
			case failure.Code == "BUS_001":
				code = "AccountUnavailableException"
			}
		}
		failureCode = &code
	}
	var resourceID *string
	if action == "logoutEverywhere" && actor.ID != "" {
		resourceID = &actor.ID
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO public.t_business_audit_events
		(id,actor_user_id,actor_email,action,resource_type,resource_id,http_method,request_path,request_id,ip_address,success,error_code,metadata)
		VALUES(gen_random_uuid(),NULLIF($1,'')::uuid,NULLIF($2,''),$3,'Auth',$4,'POST',$5,$6,$7,$8,$9,$10)`,
		actor.ID, actor.Email, "AuthController."+action, resourceID, path, requestID, truncate(ip, 64), operationError == nil, failureCode, "method=AuthController."+action+"(..)")
	return err
}

func (s *Service) RecordIdentityAudit(ctx context.Context, action, method, path, id, requestID, ip string, actor User, operationError error) error {
	var failureCode *string
	if operationError != nil {
		code := "InternalError"
		var failure *Failure
		if errors.As(operationError, &failure) {
			code = failure.Code
		}
		failureCode = &code
	}
	resource := strings.TrimSuffix(strings.SplitN(action, ".", 2)[0], "Controller")
	_, err := s.pool.Exec(ctx, `INSERT INTO public.t_business_audit_events(id,actor_user_id,actor_email,action,resource_type,resource_id,http_method,request_path,request_id,ip_address,success,error_code,metadata)
 VALUES(gen_random_uuid(),$1::uuid,$2,$3,$4,NULLIF($5,''),$6,$7,$8,$9,$10,$11,$12)`, actor.ID, actor.Email, action, resource, id, method, path, requestID, truncate(ip, 64), operationError == nil, failureCode, "method="+action+"(..)")
	return err
}
