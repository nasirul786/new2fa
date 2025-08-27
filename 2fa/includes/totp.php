<?php
class TOTP {
    public static function generateSecret($length = 32) {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';
        for ($i = 0; $i < $length; $i++) {
            $secret .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $secret;
    }
    
    public static function generateCode($secret, $timestamp = null) {
        if ($timestamp === null) {
            $timestamp = time();
        }
        
        $timeSlice = floor($timestamp / 30);
        $secretkey = self::base32Decode($secret);
        
        $time = pack('N*', 0) . pack('N*', $timeSlice);
        $hm = hash_hmac('SHA1', $time, $secretkey, true);
        $offset = ord(substr($hm, -1)) & 0x0F;
        $hashpart = substr($hm, $offset, 4);
        
        $value = unpack('N', $hashpart);
        $value = $value[1];
        $value = $value & 0x7FFFFFFF;
        
        $modulo = pow(10, 6);
        return str_pad($value % $modulo, 6, '0', STR_PAD_LEFT);
    }
    
    public static function getRemainingTime() {
        return 30 - (time() % 30);
    }
    
    private static function base32Decode($secret) {
        $base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $base32charsArray = str_split($base32chars);
        $base32charsFlipped = array_flip($base32charsArray);
        
        $paddingCharCount = substr_count($secret, '=');
        $allowedValues = array(6, 4, 3, 1, 0);
        if (!in_array($paddingCharCount, $allowedValues)) return false;
        for ($i = 0; $i < 4; $i++) {
            if ($paddingCharCount == $allowedValues[$i] &&
                substr($secret, -($allowedValues[$i])) != str_repeat('=', $allowedValues[$i])) return false;
        }
        $secret = str_replace('=', '', $secret);
        $secret = str_split($secret);
        $binaryString = '';
        for ($i = 0; $i < count($secret); $i = $i + 8) {
            $x = '';
            if (!in_array($secret[$i], $base32charsArray)) return false;
            for ($j = 0; $j < 8; $j++) {
                $x .= str_pad(base_convert(@$base32charsFlipped[@$secret[$i + $j]], 10, 2), 5, '0', STR_PAD_LEFT);
            }
            $eightBits = str_split($x, 8);
            for ($z = 0; $z < count($eightBits); $z++) {
                $binaryString .= (($y = chr(base_convert($eightBits[$z], 2, 10))) || ord($y) == 48) ? $y : '';
            }
        }
        return $binaryString;
    }
    
    public static function parseOtpAuthUrl($url) {
        if (!preg_match('/^otpauth:\/\/totp\/(.+)\?(.+)$/', $url, $matches)) {
            return false;
        }
        
        $label = urldecode($matches[1]);
        parse_str($matches[2], $params);
        
        if (!isset($params['secret'])) {
            return false;
        }
        
        $service = '';
        $account = $label;
        
        if (strpos($label, ':') !== false) {
            list($service, $account) = explode(':', $label, 2);
        } elseif (isset($params['issuer'])) {
            $service = $params['issuer'];
        }
        
        return [
            'service' => trim($service),
            'label' => trim($account),
            'secret' => $params['secret']
        ];
    }
}
?>
