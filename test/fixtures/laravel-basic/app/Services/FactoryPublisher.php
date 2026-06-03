<?php

namespace App\Services;

use App\Contracts\FactoryPublisherInterface;

class FactoryPublisher implements FactoryPublisherInterface
{
    public function publishFromFactory(string $message): bool
    {
        return $message !== '';
    }
}
