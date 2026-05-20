<?php

namespace App\Http;

use App\Http\Middleware\EnsureProjectIsActive;
use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    protected $middlewareAliases = [
        'auth' => \App\Http\Middleware\Authenticate::class,
        'project.active' => EnsureProjectIsActive::class,
        'verified' => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,
    ];
}
