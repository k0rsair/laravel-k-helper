<?php

namespace App\Services;

use App\Contracts\PublisherInterface;

class PublishingWorkflow
{
    public function __construct(private readonly PublisherInterface $publisher)
    {
    }

    public function run(PublisherInterface $publisher): bool
    {
        $first = $publisher->publish('local');
        $second = $this->publisher->publish('property');
        $third = app(PublisherInterface::class)->publish('container');

        return $first && $second && $third;
    }
}
