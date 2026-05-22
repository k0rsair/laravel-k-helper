<?php

namespace App\Providers;

use Illuminate\Support\Facades\Route;

class RouteServiceProvider
{
    public function boot(): void
    {
        Route::middleware('web')->group(base_path('routes/web.php'));

        Route::prefix('api')
            ->middleware('api')
            ->group(base_path('routes/api.php'));
    }
}
