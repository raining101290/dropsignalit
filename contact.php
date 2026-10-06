<?php
/**
 * Contact form endpoint — sends enquiries through the Resend API.
 *
 * Accepts a POST from contact.html. Responds with JSON when called via fetch
 * (Accept: application/json) and with a small HTML page otherwise, so the form
 * still works with JavaScript disabled.
 *
 * Settings live in includes/config.php (blocked from the web by .htaccess).
 */

$config = require __DIR__ . '/includes/config.php';

const TOPICS = [
    'speaking'     => 'Speaking & events',
    'partnerships' => 'Partnerships & sponsorships',
    'media'        => 'Media & interviews',
    'support'      => 'Course support',
    'advisory'     => 'Advisory',
    'other'        => 'Something else',
];

const BUDGETS = [
    'lt5'    => 'Under $5k',
    '5-15'   => '$5k–15k',
    '15-30'  => '$15k–30k',
    '30plus' => '$30k+',
];

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$wantsJson = strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

/* --------------------------------------------------------------------------
   Response helper
   -------------------------------------------------------------------------- */
function respond(bool $ok, string $message, int $status = 200, array $errors = []): void
{
    global $wantsJson;
    http_response_code($status);

    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message, 'errors' => (object) $errors]);
        exit;
    }

    // No-JavaScript fallback: a minimal page that links back to the form
    header('Content-Type: text/html; charset=utf-8');
    $title = $ok ? 'Message sent' : 'Message not sent';
    $safe  = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    $list  = '';
    foreach ($errors as $error) {
        $list .= '<li>' . htmlspecialchars($error, ENT_QUOTES, 'UTF-8') . '</li>';
    }
    echo "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>{$title}</title>"
        . '<style>body{font-family:system-ui,sans-serif;background:#FAFAF8;color:#222;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.25rem}main{max-width:32rem}h1{font-family:Georgia,serif;color:#0F172A}a{color:#059669}</style></head>'
        . "<body><main><h1>{$title}</h1><p>{$safe}</p>" . ($list ? "<ul>{$list}</ul>" : '') . '<p><a href="contact.html">&larr; Back to the contact page</a></p></main></body></html>';
    exit;
}

/* --------------------------------------------------------------------------
   Request guards
   -------------------------------------------------------------------------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(false, 'This address only accepts form submissions.', 405);
}

// Reject cross-site posts when an allow-list is configured
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !empty($config['allowed_origins']) && !in_array($origin, $config['allowed_origins'], true)) {
    respond(false, 'Submissions from this site are not allowed.', 403);
}

if (empty($config['resend_api_key']) || strpos($config['resend_api_key'], 're_') !== 0 || strpos($config['resend_api_key'], 'REPLACE') !== false) {
    error_log('[contact] Resend API key is missing from includes/config.php');
    respond(false, 'The contact form is not configured yet. Please email us directly.', 500);
}

// Honeypot: real people never see or fill the "website" field
if (!empty($_POST['website'])) {
    respond(true, 'Thank you! Your message is on its way.');
}

/* --------------------------------------------------------------------------
   Validation (mirrors the rules in assets/js/main.js)
   -------------------------------------------------------------------------- */
$clean = static function (string $key, int $max): string {
    $value = trim((string) ($_POST[$key] ?? ''));
    $value = str_replace("\0", '', $value);
    return mb_substr($value, 0, $max);
};

$name    = preg_replace('/[\r\n]+/', ' ', $clean('name', 100));
$email   = $clean('email', 254);
$topic   = $clean('topic', 40);
$budget  = $clean('budget', 20);
$message = $clean('message', 5000);

$errors = [];
if (mb_strlen($name) < 2) {
    $errors['name'] = 'Please share your name.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Please enter a valid email address.';
}
if (!isset(TOPICS[$topic])) {
    $errors['topic'] = 'Please choose a topic.';
}
if (mb_strlen($message) < 20) {
    $errors['message'] = 'Your message should be at least 20 characters.';
}
if ($errors) {
    respond(false, 'Please fix the highlighted fields.', 422, $errors);
}

/* --------------------------------------------------------------------------
   Rate limit: N submissions per IP per hour (file based, no database)
   -------------------------------------------------------------------------- */
$limit = (int) ($config['rate_limit_per_hour'] ?? 5);
if ($limit > 0) {
    $dir = __DIR__ . '/includes/storage';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    $file = $dir . '/rl_' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . __FILE__) . '.json';
    $now  = time();
    $hits = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    $hits = array_values(array_filter($hits, static fn ($t) => $t > $now - 3600));
    if (count($hits) >= $limit) {
        respond(false, 'Too many messages in a short time. Please try again later or email us directly.', 429);
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
}

/* --------------------------------------------------------------------------
   Build and send the email
   -------------------------------------------------------------------------- */
$h = static fn (string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');

$topicLabel  = TOPICS[$topic];
$budgetLabel = BUDGETS[$budget] ?? 'Not specified';
$subject     = "New enquiry: {$topicLabel} — {$name}";

$rows = [
    'Name'   => $h($name),
    'Email'  => '<a href="mailto:' . $h($email) . '">' . $h($email) . '</a>',
    'Topic'  => $h($topicLabel),
    'Budget' => $h($budgetLabel),
];
$tableRows = '';
foreach ($rows as $label => $value) {
    $tableRows .= "<tr><td style=\"padding:6px 16px 6px 0;color:#5F6470\">{$label}</td><td style=\"padding:6px 0;color:#0F172A\">{$value}</td></tr>";
}

$html = '<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">'
    . '<h2 style="font-family:Georgia,serif;color:#0F172A;margin:0 0 16px">New message from the website</h2>'
    . "<table style=\"border-collapse:collapse;margin-bottom:16px\">{$tableRows}</table>"
    . '<div style="padding:16px;background:#F2F0EA;border-radius:8px;white-space:pre-wrap">' . $h($message) . '</div>'
    . '<p style="color:#5F6470;font-size:13px;margin-top:16px">Reply directly to this email to respond to ' . $h($name) . '.</p>'
    . '</div>';

$text = "New message from the website\n\n"
    . "Name: {$name}\nEmail: {$email}\nTopic: {$topicLabel}\nBudget: {$budgetLabel}\n\n{$message}\n";

$payload = [
    'from'     => $config['from_email'],
    'to'       => (array) $config['to_email'],
    'reply_to' => $email,
    'subject'  => $subject,
    'html'     => $html,
    'text'     => $text,
];

$ch = curl_init('https://api.resend.com/emails');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $config['resend_api_key'],
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
]);
$body   = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($body === false || $status < 200 || $status >= 300) {
    error_log('[contact] Resend request failed (HTTP ' . $status . '): ' . ($curlError ?: $body));
    respond(false, 'Sorry, your message could not be sent right now. Please try again or email us directly.', 502);
}

respond(true, 'Thank you! Your message is on its way. Expect a reply within three business days.');
