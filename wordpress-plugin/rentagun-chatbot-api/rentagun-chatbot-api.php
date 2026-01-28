<?php
/**
 * Plugin Name: Rentagun Chatbot API
 * Plugin URI: https://rentagun.com
 * Description: Custom REST API endpoints for the Rentagun AI Concierge chatbot
 * Version: 1.0.0
 * Author: Rentagun
 * License: Proprietary
 *
 * Provides:
 * - GET  /wp-json/rentagun/v1/products - List products with availability
 * - POST /wp-json/rentagun/v1/availability - Check specific date availability
 * - POST /wp-json/rentagun/v1/orders/lookup - Order lookup with email verification
 */

if (!defined('ABSPATH')) {
    exit;
}

class Rentagun_Chatbot_API {

    const API_NAMESPACE = 'rentagun/v1';
    const OPTION_API_KEY = 'rentagun_chatbot_api_key';

    /**
     * Inventory status constants (from rag_inventory table)
     */
    const STATUS_AVAILABLE = 'AVAILABLE';
    const STATUS_RESERVED = 'RESERVED';
    const STATUS_IN_TRANSIT_OUT = 'IN_TRANSIT_OUT';
    const STATUS_WITH_CUSTOMER = 'WITH_CUSTOMER';
    const STATUS_IN_TRANSIT_RETURN = 'IN_TRANSIT_RETURN';
    const STATUS_MAINTENANCE = 'MAINTENANCE';

    /**
     * Buffer period after rental returns (days)
     */
    const BUFFER_DAYS = 2;

    /**
     * Rate limiting for order lookups
     */
    private static $rate_limits = [];
    const RATE_LIMIT_ORDERS = 5;
    const RATE_LIMIT_WINDOW = 3600; // 1 hour

    /**
     * Initialize the plugin
     */
    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);

        // Generate API key on activation if not exists
        register_activation_hook(__FILE__, [$this, 'activate']);
    }

    /**
     * Plugin activation
     */
    public function activate() {
        if (!get_option(self::OPTION_API_KEY)) {
            update_option(self::OPTION_API_KEY, wp_generate_password(32, false));
        }
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Products endpoint
        register_rest_route(self::API_NAMESPACE, '/products', [
            'methods' => 'GET',
            'callback' => [$this, 'get_products'],
            'permission_callback' => [$this, 'verify_api_key'],
            'args' => [
                'page' => [
                    'default' => 1,
                    'validate_callback' => function($param) {
                        return is_numeric($param) && $param > 0;
                    }
                ],
                'per_page' => [
                    'default' => 20,
                    'validate_callback' => function($param) {
                        return is_numeric($param) && $param > 0 && $param <= 100;
                    }
                ],
                'category' => [
                    'default' => '',
                    'sanitize_callback' => 'sanitize_text_field'
                ],
                'search' => [
                    'default' => '',
                    'sanitize_callback' => 'sanitize_text_field'
                ],
                'available_only' => [
                    'default' => false,
                    'validate_callback' => function($param) {
                        return is_bool($param) || $param === 'true' || $param === 'false';
                    }
                ]
            ]
        ]);

        // Availability check endpoint
        register_rest_route(self::API_NAMESPACE, '/availability', [
            'methods' => 'POST',
            'callback' => [$this, 'check_availability'],
            'permission_callback' => [$this, 'verify_api_key'],
            'args' => [
                'product_id' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param) && $param > 0;
                    }
                ],
                'start_date' => [
                    'required' => true,
                    'validate_callback' => [$this, 'validate_date']
                ],
                'end_date' => [
                    'required' => true,
                    'validate_callback' => [$this, 'validate_date']
                ]
            ]
        ]);

        // Order lookup endpoint
        register_rest_route(self::API_NAMESPACE, '/orders/lookup', [
            'methods' => 'POST',
            'callback' => [$this, 'lookup_order'],
            'permission_callback' => [$this, 'verify_api_key'],
            'args' => [
                'order_number' => [
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field'
                ],
                'email' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_email($param);
                    },
                    'sanitize_callback' => 'sanitize_email'
                ]
            ]
        ]);
    }

    /**
     * Verify API key from request header
     */
    public function verify_api_key($request) {
        $api_key = $request->get_header('X-API-Key');
        $stored_key = get_option(self::OPTION_API_KEY);

        if (empty($api_key) || $api_key !== $stored_key) {
            return new WP_Error(
                'unauthorized',
                'Invalid or missing API key',
                ['status' => 401]
            );
        }

        return true;
    }

    /**
     * Validate date format
     */
    public function validate_date($param) {
        $date = DateTime::createFromFormat('Y-m-d', $param);
        return $date && $date->format('Y-m-d') === $param;
    }

    /**
     * GET /products - List products with availability
     */
    public function get_products($request) {
        $page = (int) $request->get_param('page');
        $per_page = (int) $request->get_param('per_page');
        $category = $request->get_param('category');
        $search = $request->get_param('search');
        $available_only = $request->get_param('available_only');

        // Convert string boolean
        if ($available_only === 'true') $available_only = true;
        if ($available_only === 'false') $available_only = false;

        // Build query args for WooCommerce Bookable products
        $args = [
            'post_type' => 'product',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'post_status' => 'publish',
            'meta_query' => [
                [
                    'key' => '_bookable',
                    'value' => 'yes'
                ]
            ]
        ];

        // Category filter
        if (!empty($category)) {
            $args['tax_query'] = [
                [
                    'taxonomy' => 'product_cat',
                    'field' => 'slug',
                    'terms' => $category
                ]
            ];
        }

        // Search filter
        if (!empty($search)) {
            $args['s'] = $search;
        }

        $query = new WP_Query($args);
        $products = [];

        foreach ($query->posts as $post) {
            $product = wc_get_product($post->ID);
            if (!$product) continue;

            $availability = $this->get_product_availability($post->ID);

            // Skip unavailable if filter is set
            if ($available_only && !$availability['available']) {
                continue;
            }

            $products[] = [
                'id' => $post->ID,
                'name' => $product->get_name(),
                'slug' => $product->get_slug(),
                'description' => $product->get_description(),
                'short_description' => $product->get_short_description(),
                'price' => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
                'images' => $this->get_product_images($product),
                'categories' => $this->get_product_categories($product),
                'available' => $availability['available'],
                'fulfillment_source' => $availability['fulfillment_source'],
                'next_available_date' => $availability['next_available_date'],
                'resources_available' => $availability['resources_available'],
                'permalink' => get_permalink($post->ID),
                'daily_rate' => $this->calculate_daily_rate($product)
            ];
        }

        return rest_ensure_response([
            'products' => $products,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'page' => $page,
            'per_page' => $per_page
        ]);
    }

    /**
     * POST /availability - Check specific date availability
     */
    public function check_availability($request) {
        $product_id = (int) $request->get_param('product_id');
        $start_date = $request->get_param('start_date');
        $end_date = $request->get_param('end_date');

        $product = wc_get_product($product_id);
        if (!$product) {
            return new WP_Error(
                'product_not_found',
                'Product not found',
                ['status' => 404]
            );
        }

        // Validate dates are not in the past
        $today = new DateTime('today');
        $start = new DateTime($start_date);
        $end = new DateTime($end_date);

        if ($start < $today) {
            return new WP_Error(
                'invalid_date',
                'Start date cannot be in the past',
                ['status' => 400]
            );
        }

        if ($end < $start) {
            return new WP_Error(
                'invalid_date',
                'End date must be after start date',
                ['status' => 400]
            );
        }

        // Check WooCommerce Bookings availability
        $bookings_available = $this->check_bookings_availability($product_id, $start_date, $end_date);

        // Check RAG inventory status
        $inventory_status = $this->get_rag_inventory_status($product_id);

        // Determine overall availability
        $available = $bookings_available['available'] &&
                     in_array($inventory_status['status'], [self::STATUS_AVAILABLE]);

        // Calculate next available date if not available
        $next_available = null;
        if (!$available) {
            $next_available = $this->find_next_available_date($product_id, $end_date);
        }

        return rest_ensure_response([
            'product_id' => $product_id,
            'available' => $available,
            'resources_available' => $bookings_available['resources_available'],
            'fulfillment_source' => $inventory_status['fulfillment_source'],
            'next_available_date' => $next_available,
            'requested_dates' => [
                'start' => $start_date,
                'end' => $end_date
            ],
            'reason' => !$available ? $this->get_unavailability_reason($bookings_available, $inventory_status) : null
        ]);
    }

    /**
     * POST /orders/lookup - Order lookup with email verification
     */
    public function lookup_order($request) {
        $order_number = $request->get_param('order_number');
        $email = strtolower($request->get_param('email'));

        // Rate limiting
        $client_ip = $this->get_client_ip();
        if (!$this->check_rate_limit($client_ip)) {
            return new WP_Error(
                'rate_limit',
                'Too many attempts. Please try again later.',
                ['status' => 429]
            );
        }

        // Find order
        $order = wc_get_order($order_number);

        if (!$order) {
            // Log failed attempt
            $this->log_failed_attempt($client_ip, $order_number, $email);

            // Don't reveal if order exists or email is wrong
            return new WP_Error(
                'order_not_found',
                'Order not found. Please check your order number and email.',
                ['status' => 404]
            );
        }

        // Verify email (case-insensitive)
        $order_email = strtolower($order->get_billing_email());
        if ($order_email !== $email) {
            // Log failed attempt
            $this->log_failed_attempt($client_ip, $order_number, $email);

            // Same error message for security
            return new WP_Error(
                'order_not_found',
                'Order not found. Please check your order number and email.',
                ['status' => 404]
            );
        }

        // Get FFL info
        $ffl_info = $this->get_order_ffl_info($order);

        // Get shipping/tracking info
        $shipping_info = $this->get_order_shipping_info($order);

        // Get rental dates from booking
        $rental_dates = $this->get_order_rental_dates($order);

        return rest_ensure_response([
            'order' => [
                'id' => $order->get_id(),
                'order_number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'status_label' => wc_get_order_status_name($order->get_status()),
                'date_created' => $order->get_date_created()->format('Y-m-d H:i:s'),
                'customer' => [
                    'first_name' => $order->get_billing_first_name(),
                    'last_name' => $order->get_billing_last_name(),
                    'email' => $order->get_billing_email()
                ],
                'line_items' => $this->format_order_items($order),
                'shipping' => $shipping_info,
                'ffl' => $ffl_info,
                'rental_dates' => $rental_dates,
                'total' => $order->get_total()
            ]
        ]);
    }

    /**
     * Get product availability from rag_inventory table
     */
    private function get_product_availability($product_id) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'rag_inventory';

        // Check if table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") !== $table_name) {
            // Fall back to WooCommerce Bookings availability
            return [
                'available' => true,
                'fulfillment_source' => 'woocommerce',
                'next_available_date' => null,
                'resources_available' => 1
            ];
        }

        $inventory = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table_name WHERE product_id = %d",
            $product_id
        ));

        if (!$inventory) {
            // No inventory record - check if Sports South item
            $fulfillment_source = get_post_meta($product_id, '_fulfillment_source', true);
            return [
                'available' => true,
                'fulfillment_source' => $fulfillment_source ?: 'rag',
                'next_available_date' => null,
                'resources_available' => 1
            ];
        }

        $available = $inventory->status === self::STATUS_AVAILABLE;

        return [
            'available' => $available,
            'fulfillment_source' => $inventory->fulfillment_source ?? 'rag',
            'next_available_date' => $available ? null : $this->calculate_next_available($inventory),
            'resources_available' => $available ? 1 : 0
        ];
    }

    /**
     * Get RAG inventory status
     */
    private function get_rag_inventory_status($product_id) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'rag_inventory';

        if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") !== $table_name) {
            return [
                'status' => self::STATUS_AVAILABLE,
                'fulfillment_source' => 'woocommerce'
            ];
        }

        $inventory = $wpdb->get_row($wpdb->prepare(
            "SELECT status, fulfillment_source FROM $table_name WHERE product_id = %d",
            $product_id
        ));

        if (!$inventory) {
            $fulfillment_source = get_post_meta($product_id, '_fulfillment_source', true);
            return [
                'status' => self::STATUS_AVAILABLE,
                'fulfillment_source' => $fulfillment_source ?: 'rag'
            ];
        }

        return [
            'status' => $inventory->status,
            'fulfillment_source' => $inventory->fulfillment_source ?? 'rag'
        ];
    }

    /**
     * Check WooCommerce Bookings availability
     */
    private function check_bookings_availability($product_id, $start_date, $end_date) {
        if (!class_exists('WC_Bookings')) {
            return ['available' => true, 'resources_available' => 1];
        }

        $bookable_product = new WC_Product_Booking($product_id);

        $start = strtotime($start_date);
        $end = strtotime($end_date);

        // Check each day in range
        $current = $start;
        while ($current <= $end) {
            $blocks = $bookable_product->get_blocks_in_range($current, strtotime('+1 day', $current));

            // If no available blocks, not available
            if (empty($blocks)) {
                return ['available' => false, 'resources_available' => 0];
            }

            $current = strtotime('+1 day', $current);
        }

        return ['available' => true, 'resources_available' => 1];
    }

    /**
     * Find next available date
     */
    private function find_next_available_date($product_id, $after_date) {
        $check_date = new DateTime($after_date);
        $max_days = 90; // Look up to 90 days ahead

        for ($i = 1; $i <= $max_days; $i++) {
            $check_date->modify('+1 day');
            $date_str = $check_date->format('Y-m-d');
            $end_str = $check_date->modify('+6 days')->format('Y-m-d'); // 7-day rental
            $check_date->modify('-6 days'); // Reset

            $availability = $this->check_bookings_availability($product_id, $date_str, $end_str);
            if ($availability['available']) {
                return $date_str;
            }
        }

        return null;
    }

    /**
     * Calculate next available date from inventory
     */
    private function calculate_next_available($inventory) {
        if (empty($inventory->expected_return_date)) {
            return null;
        }

        $return_date = new DateTime($inventory->expected_return_date);
        $return_date->modify('+' . self::BUFFER_DAYS . ' days');

        return $return_date->format('Y-m-d');
    }

    /**
     * Get unavailability reason
     */
    private function get_unavailability_reason($bookings, $inventory) {
        if ($inventory['status'] === self::STATUS_WITH_CUSTOMER) {
            return 'Currently rented to another customer';
        }
        if ($inventory['status'] === self::STATUS_IN_TRANSIT_OUT) {
            return 'Currently being shipped to customer';
        }
        if ($inventory['status'] === self::STATUS_IN_TRANSIT_RETURN) {
            return 'Being returned, will be available soon';
        }
        if ($inventory['status'] === self::STATUS_MAINTENANCE) {
            return 'Undergoing maintenance';
        }
        if (!$bookings['available']) {
            return 'Already booked for these dates';
        }
        return 'Not available';
    }

    /**
     * Get product images
     */
    private function get_product_images($product) {
        $images = [];

        // Main image
        $main_image_id = $product->get_image_id();
        if ($main_image_id) {
            $images[] = [
                'id' => $main_image_id,
                'src' => wp_get_attachment_url($main_image_id),
                'alt' => get_post_meta($main_image_id, '_wp_attachment_image_alt', true)
            ];
        }

        // Gallery images
        $gallery_ids = $product->get_gallery_image_ids();
        foreach ($gallery_ids as $image_id) {
            $images[] = [
                'id' => $image_id,
                'src' => wp_get_attachment_url($image_id),
                'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true)
            ];
        }

        return $images;
    }

    /**
     * Get product categories
     */
    private function get_product_categories($product) {
        $categories = [];
        $terms = get_the_terms($product->get_id(), 'product_cat');

        if ($terms && !is_wp_error($terms)) {
            foreach ($terms as $term) {
                $categories[] = [
                    'id' => $term->term_id,
                    'name' => $term->name,
                    'slug' => $term->slug
                ];
            }
        }

        return $categories;
    }

    /**
     * Calculate daily rental rate (2% of MSRP)
     */
    private function calculate_daily_rate($product) {
        $price = $product->get_regular_price();
        if (!$price) return 0;

        return round($price * 0.02, 2);
    }

    /**
     * Get order FFL information
     */
    private function get_order_ffl_info($order) {
        $ffl_id = $order->get_meta('_ffl_dealer_id');

        if (!$ffl_id) {
            return null;
        }

        // Try to get from FFL post type or meta
        $ffl_name = $order->get_meta('_ffl_dealer_name');
        $ffl_address = $order->get_meta('_ffl_dealer_address');
        $ffl_city = $order->get_meta('_ffl_dealer_city');
        $ffl_state = $order->get_meta('_ffl_dealer_state');
        $ffl_zip = $order->get_meta('_ffl_dealer_zip');
        $ffl_phone = $order->get_meta('_ffl_dealer_phone');

        return [
            'id' => $ffl_id,
            'name' => $ffl_name,
            'address' => $ffl_address,
            'city' => $ffl_city,
            'state' => $ffl_state,
            'zip' => $ffl_zip,
            'phone' => $ffl_phone
        ];
    }

    /**
     * Get order shipping/tracking information
     */
    private function get_order_shipping_info($order) {
        // Check for FedEx tracking
        $tracking_number = $order->get_meta('_fedex_tracking_number');
        $tracking_url = null;

        if ($tracking_number) {
            $tracking_url = 'https://www.fedex.com/apps/fedextrack/?action=track&tracknumbers=' . $tracking_number;
        }

        // Check for shipment date
        $shipped_date = $order->get_meta('_shipment_date');

        return [
            'tracking_number' => $tracking_number,
            'tracking_url' => $tracking_url,
            'carrier' => $tracking_number ? 'FedEx' : null,
            'shipped_date' => $shipped_date
        ];
    }

    /**
     * Get rental dates from booking
     */
    private function get_order_rental_dates($order) {
        if (!class_exists('WC_Bookings')) {
            return null;
        }

        $bookings = WC_Booking_Data_Store::get_booking_ids_from_order_id($order->get_id());

        if (empty($bookings)) {
            return null;
        }

        $booking = get_wc_booking($bookings[0]);
        if (!$booking) {
            return null;
        }

        return [
            'start_date' => $booking->get_start_date('Y-m-d'),
            'end_date' => $booking->get_end_date('Y-m-d')
        ];
    }

    /**
     * Format order line items
     */
    private function format_order_items($order) {
        $items = [];

        foreach ($order->get_items() as $item) {
            $product = $item->get_product();

            $items[] = [
                'id' => $item->get_id(),
                'product_id' => $item->get_product_id(),
                'name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'total' => $item->get_total(),
                'image' => $product ? wp_get_attachment_url($product->get_image_id()) : null
            ];
        }

        return $items;
    }

    /**
     * Check rate limit for IP
     */
    private function check_rate_limit($ip) {
        $transient_key = 'rag_rate_' . md5($ip);
        $attempts = get_transient($transient_key);

        if ($attempts === false) {
            set_transient($transient_key, 1, self::RATE_LIMIT_WINDOW);
            return true;
        }

        if ($attempts >= self::RATE_LIMIT_ORDERS) {
            return false;
        }

        set_transient($transient_key, $attempts + 1, self::RATE_LIMIT_WINDOW);
        return true;
    }

    /**
     * Log failed order lookup attempt
     */
    private function log_failed_attempt($ip, $order_number, $email) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log(sprintf(
                '[Rentagun Chatbot API] Failed order lookup: IP=%s, Order=%s, Email=%s',
                $ip,
                $order_number,
                $email
            ));
        }
    }

    /**
     * Get client IP address
     */
    private function get_client_ip() {
        $ip = '';

        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
        } else {
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        }

        return sanitize_text_field(trim($ip));
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'Rentagun Chatbot API',
            'Chatbot API',
            'manage_options',
            'rentagun-chatbot-api',
            [$this, 'render_admin_page']
        );
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('rentagun_chatbot_api', self::OPTION_API_KEY);
    }

    /**
     * Render admin settings page
     */
    public function render_admin_page() {
        $api_key = get_option(self::OPTION_API_KEY);
        ?>
        <div class="wrap">
            <h1>Rentagun Chatbot API Settings</h1>

            <h2>API Key</h2>
            <p>Use this API key in the <code>X-API-Key</code> header when making requests to the chatbot API.</p>

            <table class="form-table">
                <tr>
                    <th>API Key</th>
                    <td>
                        <code style="font-size: 14px; padding: 10px; background: #f0f0f0; display: inline-block;">
                            <?php echo esc_html($api_key); ?>
                        </code>
                        <p class="description">
                            <a href="<?php echo wp_nonce_url(admin_url('options-general.php?page=rentagun-chatbot-api&action=regenerate'), 'regenerate_api_key'); ?>">
                                Regenerate API Key
                            </a>
                        </p>
                    </td>
                </tr>
            </table>

            <h2>Available Endpoints</h2>
            <table class="widefat" style="max-width: 800px;">
                <thead>
                    <tr>
                        <th>Method</th>
                        <th>Endpoint</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>GET</code></td>
                        <td><code>/wp-json/rentagun/v1/products</code></td>
                        <td>List products with availability status</td>
                    </tr>
                    <tr>
                        <td><code>POST</code></td>
                        <td><code>/wp-json/rentagun/v1/availability</code></td>
                        <td>Check availability for specific dates</td>
                    </tr>
                    <tr>
                        <td><code>POST</code></td>
                        <td><code>/wp-json/rentagun/v1/orders/lookup</code></td>
                        <td>Look up order by number and email</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <?php

        // Handle regenerate action
        if (isset($_GET['action']) && $_GET['action'] === 'regenerate' && wp_verify_nonce($_GET['_wpnonce'], 'regenerate_api_key')) {
            update_option(self::OPTION_API_KEY, wp_generate_password(32, false));
            wp_redirect(admin_url('options-general.php?page=rentagun-chatbot-api&regenerated=1'));
            exit;
        }

        if (isset($_GET['regenerated'])) {
            echo '<div class="notice notice-success"><p>API key regenerated successfully.</p></div>';
        }
    }
}

// Initialize the plugin
new Rentagun_Chatbot_API();
