<?php

namespace App\Providers;

use App\Contracts\PublisherInterface;
use App\Contracts\FactoryPublisherInterface;
use App\Contracts\ClosurePublisherInterface;
use App\Services\ClosurePublisher;
use App\Services\DatabasePublisher;
use App\Services\FactoryPublisher;

class AppServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PublisherInterface::class, DatabasePublisher::class);
        $this->app->singleton(FactoryPublisherInterface::class, fn () => new FactoryPublisher());
        $this->app->scoped(ClosurePublisherInterface::class, function () {
            return new ClosurePublisher();
        });
    }
}
