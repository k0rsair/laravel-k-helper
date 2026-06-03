<?php

namespace App\Contracts;

interface ClosurePublisherInterface
{
    public function publishFromClosure(string $message): bool;
}
