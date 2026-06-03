<?php

namespace App\Contracts;

interface PublisherInterface
{
    public function publish(string $message): bool;
}
