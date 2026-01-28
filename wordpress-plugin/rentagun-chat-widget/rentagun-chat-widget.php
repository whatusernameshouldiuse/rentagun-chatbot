<?php
/**
 * Plugin Name: Rentagun Chat Widget
 * Plugin URI: https://rentagun.com
 * Description: Embeds the Rentagun AI concierge chatbot widget on your site
 * Version: 1.0.0
 * Author: Rentagun
 * Author URI: https://rentagun.com
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

class Rentagun_Chat_Widget {

    private static $instance = null;
    private $option_name = 'rentagun_chat_widget_settings';

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_widget'));
        add_action('wp_footer', array($this, 'output_widget_config'));
    }

    /**
     * Get default settings
     */
    private function get_defaults() {
        return array(
            'enabled' => true,
            'widget_url' => 'https://rentagun-chatbot.vercel.app',
            'position' => 'bottom-right',
            'greeting' => "Hey there! I'm the Rentagun assistant. Looking for the perfect rental? I can help you find firearms, check availability, or track your order. What can I help you with?",
            'display_on' => 'all', // all, homepage, products
            'mobile_enabled' => true,
            'delay_seconds' => 0,
        );
    }

    /**
     * Get current settings with defaults
     */
    private function get_settings() {
        $saved = get_option($this->option_name, array());
        return wp_parse_args($saved, $this->get_defaults());
    }

    /**
     * Add admin menu page
     */
    public function add_admin_menu() {
        add_options_page(
            'Rentagun Chat Widget',
            'Rentagun Chat',
            'manage_options',
            'rentagun-chat-widget',
            array($this, 'render_settings_page')
        );
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting(
            'rentagun_chat_widget_group',
            $this->option_name,
            array($this, 'sanitize_settings')
        );

        // General Section
        add_settings_section(
            'rentagun_chat_general',
            'General Settings',
            array($this, 'section_general_callback'),
            'rentagun-chat-widget'
        );

        add_settings_field(
            'enabled',
            'Enable Widget',
            array($this, 'field_enabled_callback'),
            'rentagun-chat-widget',
            'rentagun_chat_general'
        );

        add_settings_field(
            'widget_url',
            'Widget URL',
            array($this, 'field_widget_url_callback'),
            'rentagun-chat-widget',
            'rentagun_chat_general'
        );

        // Appearance Section
        add_settings_section(
            'rentagun_chat_appearance',
            'Appearance',
            array($this, 'section_appearance_callback'),
            'rentagun-chat-widget'
        );

        add_settings_field(
            'position',
            'Widget Position',
            array($this, 'field_position_callback'),
            'rentagun-chat-widget',
            'rentagun_chat_appearance'
        );

        add_settings_field(
            'greeting',
            'Greeting Message',
            array($this, 'field_greeting_callback'),
            'rentagun-chat-widget',
            'rentagun_chat_appearance'
        );

        // Display Section
        add_settings_section(
            'rentagun_chat_display',
            'Display Rules',
            array($this, 'section_display_callback'),
            'rentagun-chat-widget'
        );

        add_settings_field(
            'display_on',
            'Show Widget On',
            array($this, 'field_display_on_callback'),
            'rentagun-chat-widget',
            'rentagun_chat_display'
        );

        add_settings_field(
            'mobile_enabled',
            'Mobile Devices',
            array($this, 'field_mobile_enabled_callback'),
            'rentagun-chat-widget',
            'rentagun_chat_display'
        );

        add_settings_field(
            'delay_seconds',
            'Load Delay',
            array($this, 'field_delay_callback'),
            'rentagun-chat-widget',
            'rentagun_chat_display'
        );
    }

    /**
     * Sanitize settings on save
     */
    public function sanitize_settings($input) {
        $sanitized = array();

        $sanitized['enabled'] = !empty($input['enabled']);
        $sanitized['widget_url'] = esc_url_raw($input['widget_url']);
        $sanitized['position'] = in_array($input['position'], array('bottom-right', 'bottom-left'))
            ? $input['position']
            : 'bottom-right';
        $sanitized['greeting'] = sanitize_textarea_field($input['greeting']);
        $sanitized['display_on'] = in_array($input['display_on'], array('all', 'homepage', 'products'))
            ? $input['display_on']
            : 'all';
        $sanitized['mobile_enabled'] = !empty($input['mobile_enabled']);
        $sanitized['delay_seconds'] = absint($input['delay_seconds']);

        return $sanitized;
    }

    // Section callbacks
    public function section_general_callback() {
        echo '<p>Configure the basic settings for your Rentagun chat widget.</p>';
    }

    public function section_appearance_callback() {
        echo '<p>Customize how the widget looks and behaves.</p>';
    }

    public function section_display_callback() {
        echo '<p>Control where and when the widget appears.</p>';
    }

    // Field callbacks
    public function field_enabled_callback() {
        $settings = $this->get_settings();
        ?>
        <label>
            <input type="checkbox" name="<?php echo $this->option_name; ?>[enabled]" value="1"
                <?php checked($settings['enabled']); ?>>
            Show chat widget on the site
        </label>
        <?php
    }

    public function field_widget_url_callback() {
        $settings = $this->get_settings();
        ?>
        <input type="url" name="<?php echo $this->option_name; ?>[widget_url]"
            value="<?php echo esc_attr($settings['widget_url']); ?>"
            class="regular-text">
        <p class="description">The URL of your Rentagun chatbot deployment (e.g., https://rentagun-chatbot.vercel.app)</p>
        <?php
    }

    public function field_position_callback() {
        $settings = $this->get_settings();
        ?>
        <select name="<?php echo $this->option_name; ?>[position]">
            <option value="bottom-right" <?php selected($settings['position'], 'bottom-right'); ?>>Bottom Right</option>
            <option value="bottom-left" <?php selected($settings['position'], 'bottom-left'); ?>>Bottom Left</option>
        </select>
        <?php
    }

    public function field_greeting_callback() {
        $settings = $this->get_settings();
        ?>
        <textarea name="<?php echo $this->option_name; ?>[greeting]" rows="4" class="large-text"><?php
            echo esc_textarea($settings['greeting']);
        ?></textarea>
        <p class="description">The welcome message shown when users first open the chat.</p>
        <?php
    }

    public function field_display_on_callback() {
        $settings = $this->get_settings();
        ?>
        <select name="<?php echo $this->option_name; ?>[display_on]">
            <option value="all" <?php selected($settings['display_on'], 'all'); ?>>All Pages</option>
            <option value="homepage" <?php selected($settings['display_on'], 'homepage'); ?>>Homepage Only</option>
            <option value="products" <?php selected($settings['display_on'], 'products'); ?>>Product Pages Only</option>
        </select>
        <?php
    }

    public function field_mobile_enabled_callback() {
        $settings = $this->get_settings();
        ?>
        <label>
            <input type="checkbox" name="<?php echo $this->option_name; ?>[mobile_enabled]" value="1"
                <?php checked($settings['mobile_enabled']); ?>>
            Show widget on mobile devices
        </label>
        <?php
    }

    public function field_delay_callback() {
        $settings = $this->get_settings();
        ?>
        <input type="number" name="<?php echo $this->option_name; ?>[delay_seconds]"
            value="<?php echo esc_attr($settings['delay_seconds']); ?>"
            min="0" max="60" step="1" class="small-text">
        <span>seconds</span>
        <p class="description">Wait this many seconds before loading the widget (0 = immediate).</p>
        <?php
    }

    /**
     * Render the settings page
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        if (isset($_GET['settings-updated'])) {
            add_settings_error(
                'rentagun_chat_messages',
                'rentagun_chat_message',
                'Settings Saved',
                'updated'
            );
        }

        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <?php settings_errors('rentagun_chat_messages'); ?>

            <form action="options.php" method="post">
                <?php
                settings_fields('rentagun_chat_widget_group');
                do_settings_sections('rentagun-chat-widget');
                submit_button('Save Settings');
                ?>
            </form>

            <hr>

            <h2>Preview</h2>
            <p>The chat widget will appear as a floating button in the <?php
                echo esc_html($this->get_settings()['position'] === 'bottom-left' ? 'bottom-left' : 'bottom-right');
            ?> corner of your site.</p>

            <h2>Troubleshooting</h2>
            <ul>
                <li><strong>Widget not showing?</strong> Make sure "Enable Widget" is checked and the Widget URL is correct.</li>
                <li><strong>CORS errors?</strong> Ensure your chatbot deployment allows requests from <?php echo esc_html(home_url()); ?></li>
                <li><strong>Styling conflicts?</strong> The widget uses isolated CSS. Contact support if you see issues.</li>
            </ul>
        </div>
        <?php
    }

    /**
     * Check if widget should display on current page
     */
    private function should_display() {
        $settings = $this->get_settings();

        // Check if enabled
        if (!$settings['enabled']) {
            return false;
        }

        // Check mobile
        if (!$settings['mobile_enabled'] && wp_is_mobile()) {
            return false;
        }

        // Check display rules
        switch ($settings['display_on']) {
            case 'homepage':
                return is_front_page() || is_home();

            case 'products':
                // WooCommerce product pages
                if (function_exists('is_product') && is_product()) {
                    return true;
                }
                // Product category/archive pages
                if (function_exists('is_product_category') && is_product_category()) {
                    return true;
                }
                if (function_exists('is_shop') && is_shop()) {
                    return true;
                }
                return false;

            case 'all':
            default:
                return true;
        }
    }

    /**
     * Enqueue widget scripts and styles
     */
    public function enqueue_widget() {
        if (!$this->should_display()) {
            return;
        }

        $settings = $this->get_settings();
        $widget_url = rtrim($settings['widget_url'], '/');

        // Enqueue widget CSS
        wp_enqueue_style(
            'rentagun-chat-widget',
            $widget_url . '/widget.css',
            array(),
            '1.0.0'
        );

        // Enqueue widget JS
        wp_enqueue_script(
            'rentagun-chat-widget',
            $widget_url . '/widget.js',
            array(),
            '1.0.0',
            true // Load in footer
        );
    }

    /**
     * Output widget configuration in footer
     */
    public function output_widget_config() {
        if (!$this->should_display()) {
            return;
        }

        $settings = $this->get_settings();
        $widget_url = rtrim($settings['widget_url'], '/');

        // Build config object
        $config = array(
            'apiUrl' => $widget_url . '/api/chat',
            'productsUrl' => $widget_url . '/api/products',
            'ordersUrl' => $widget_url . '/api/orders',
            'subscribeUrl' => $widget_url . '/api/subscribe',
            'greeting' => $settings['greeting'],
            'position' => $settings['position'],
        );

        // Get current page context
        $page_context = array();

        // Add product context if on a product page
        if (function_exists('is_product') && is_product()) {
            global $product;
            if ($product) {
                $page_context['productId'] = $product->get_id();
                $page_context['productName'] = $product->get_name();
                $page_context['productType'] = $product->get_type();
            }
        }

        if (!empty($page_context)) {
            $config['pageContext'] = $page_context;
        }

        // Output config script
        ?>
        <script>
        window.RENTAGUN_CHAT_CONFIG = <?php echo wp_json_encode($config); ?>;
        <?php if ($settings['delay_seconds'] > 0) : ?>
        // Delay widget initialization
        (function() {
            var originalInit = window.RentagunChat && window.RentagunChat.init;
            if (typeof originalInit === 'function') {
                window.RentagunChat.init = function() {
                    setTimeout(function() {
                        originalInit.call(window.RentagunChat);
                    }, <?php echo intval($settings['delay_seconds']) * 1000; ?>);
                };
            }
        })();
        <?php endif; ?>
        </script>
        <?php
    }
}

// Initialize plugin
Rentagun_Chat_Widget::get_instance();
