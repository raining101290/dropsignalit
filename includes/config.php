<?php
/**
 * Contact form settings — used by contact.php.
 * This folder is blocked from the web by includes/.htaccess.
 */
return [
    // Create a key at https://resend.com/api-keys (starts with "re_")
    'resend_api_key' => 're_REPLACE_WITH_YOUR_KEY',

    // Must use a domain verified in Resend (https://resend.com/domains)
    'from_email' => 'Website Contact <noreply@dropsignalit.com>',

    // Where enquiries are delivered — a string or an array of addresses
    'to_email' => 'hello@dropsignalit.com',

    // Only accept posts from these origins; leave empty to allow any
    'allowed_origins' => [
        'https://dropsignalit.com',
        'https://www.dropsignalit.com',
    ],

    // Max submissions per visitor IP per hour (0 disables the limit)
    'rate_limit_per_hour' => 5,
];
