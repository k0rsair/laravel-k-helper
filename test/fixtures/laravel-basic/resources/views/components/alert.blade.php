@props([
    'tone' => 'info',
    'message',
])

<div {{ $attributes }}>
    <span>{{ $message }}</span>
    {{ $slot }}
</div>
