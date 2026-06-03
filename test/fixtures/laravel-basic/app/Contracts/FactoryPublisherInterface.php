<?php

namespace App\Contracts;

interface FactoryPublisherInterface
{
    public function publishFromFactory(string $message): bool;
}
