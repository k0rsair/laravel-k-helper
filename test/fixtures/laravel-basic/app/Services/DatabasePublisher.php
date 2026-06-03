<?php

namespace App\Services;

use App\Contracts\PublisherInterface;

class DatabasePublisher implements PublisherInterface
{
    public function publish(string $message): bool
    {
        return $message !== '';
    }

    public function status(): string
    {
        return 'ready';
    }

    protected function internalState(): string
    {
        return 'hidden';
    }
}
