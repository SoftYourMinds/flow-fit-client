import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { UiService } from '../services/ui.service';

export const globalErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const uiService = inject(UiService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 is handled by auth.interceptor, but we might want to skip toast for it
      // if it's gracefully refreshing. However, if it fails completely, auth interceptor
      // usually handles logout. We will show toast for 5xx, 400, 403, 404, etc.
      
      // Skip silent errors
      if (!req.headers.has('x-silent-error')) {
        let errorMsg = 'Виникла помилка. Спробуйте ще раз.';
        
        if (error.error && error.error.message) {
          // If backend returns a specific error message
          errorMsg = Array.isArray(error.error.message) 
            ? error.error.message.join(', ') 
            : error.error.message;
        } else if (error.status === 0) {
          errorMsg = 'Відсутнє підключення до інтернету або сервер недоступний.';
        } else if (error.status === 401) {
          // We can let auth interceptor handle this silently if refreshing,
          // but if we show it here, it might be spammy. Let's show a standard message.
          errorMsg = 'Помилка авторизації. Будь ласка, увійдіть знову.';
        } else if (error.status === 403) {
          errorMsg = 'У вас немає доступу до цієї дії.';
        } else if (error.status === 404) {
          errorMsg = 'Дані не знайдено.';
        } else if (error.status >= 500) {
          errorMsg = 'Помилка сервера. Спробуйте пізніше.';
        }
        
        uiService.showErrorToast(errorMsg);
      }

      return throwError(() => error);
    })
  );
};
