<?php

namespace App\Providers;

use App\Nova\User;
use Laravel\Nova\Nova;

class NovaServiceProvider
{
    public function boot(): void
    {
        Nova::resources([
            User::class,
        ]);
    }
}
