<?php

namespace App\Services;

use App\Contracts\ClosurePublisherInterface;

class ClosurePublisher implements ClosurePublisherInterface
{
    public function publishFromClosure(string $message): bool
    {
        return $message !== '';
    }
}
