import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { UiService } from '../services/ui.service';

export const globalLoaderInterceptor: HttpInterceptorFn = (req, next) => {
  const uiService = inject(UiService);
  
  // Skip loader for silent requests if needed
  if (req.headers.has('x-silent-request')) {
    const newReq = req.clone({ headers: req.headers.delete('x-silent-request') });
    return next(newReq);
  }

  uiService.showLoader();

  return next(req).pipe(
    finalize(() => {
      uiService.hideLoader();
    })
  );
};
