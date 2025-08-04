#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <filesystem>
#include <map>
#include <unordered_map>
#include <nlohmann/json.hpp>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstring>
#include <cerrno>
#include <sstream>
#include <algorithm>
#include <ctime>
#include <iomanip>
#include <sys/inotify.h>
#include <mutex>
#include <thread>

using json = nlohmann::json;
namespace fs = std::filesystem;

struct ShareConfig {
    std::string path;
    std::string alias;
    bool read_only;
    bool auth_required;
};

struct WebDAVConfig {
    int port;
    std::string protocol;
    bool allowAnonymous;
    bool readOnly;
    int maxConnections;
    std::vector<ShareConfig> shares;
    struct {
        bool enabled;
        std::vector<std::string> versions;
    } nfs;
};

struct SharedConfig {
    WebDAVConfig config;
    std::mutex mutex;
};

WebDAVConfig load_config(const std::string& config_path) {
    std::ifstream config_file(config_path);
    if (!config_file.is_open()) {
        throw std::runtime_error("Cannot open config file");
    }

    json config_json;
    config_file >> config_json;

    WebDAVConfig config;
    config.port = config_json.value("port", 8080);
    config.protocol = config_json.value("protocol", "http");
    config.allowAnonymous = config_json.value("allowAnonymous", false);
    config.readOnly = config_json.value("readOnly", false);
    config.maxConnections = config_json.value("maxConnections", 50);

    for (const auto& share : config_json["shares"]) {
        config.shares.push_back({
            share["path"],
            share["alias"],
            share.value("read_only", false),
            share.value("auth_required", true)
        });
    }

    if (config_json.contains("nfs")) {
        config.nfs.enabled = config_json["nfs"].value("enabled", false);
        config.nfs.versions = config_json["nfs"].value("versions", std::vector<std::string>{"v3", "v4"});
    } else {
        config.nfs.enabled = false;
        config.nfs.versions = {"v3", "v4"};
    }

    return config;
}

void setup_config_watcher(SharedConfig& shared_config) {
    int inotify_fd = inotify_init();
    if (inotify_fd < 0) {
        std::cerr << "Error initializing inotify" << std::endl;
        return;
    }

    int watch_fd = inotify_add_watch(inotify_fd, "/etc/nas-panel/webdav.conf", IN_MODIFY);
    if (watch_fd < 0) {
        std::cerr << "Error adding watch for config file" << std::endl;
        close(inotify_fd);
        return;
    }

    std::thread([inotify_fd, &shared_config]() {
        char buffer[1024];
        while (true) {
            ssize_t length = read(inotify_fd, buffer, sizeof(buffer));
            if (length < 0) {
                std::cerr << "Error reading inotify events" << std::endl;
                break;
            }

            try {
                WebDAVConfig new_config = load_config("/etc/nas-panel/webdav.conf");
                {
                    std::lock_guard<std::mutex> lock(shared_config.mutex);
                    shared_config.config = new_config;
                }
                std::time_t now = std::time(nullptr);  // Store time in a variable
                std::cout << "[" << std::put_time(std::localtime(&now), "%Y-%m-%d %H:%M:%S")
                        << "] Configuration reloaded successfully" << std::endl;
            } catch (const std::exception& e) {
                    std::time_t now = std::time(nullptr);  // Store time in a variable
                    std::cerr << "[" << std::put_time(std::localtime(&now), "%Y-%m-%d %H:%M:%S")
                            << "] Error reloading config: " << e.what() << std::endl;
            }
        }
        close(inotify_fd);
    }).detach();
}

std::string get_mime_type(const std::string& filename) {
    static const std::unordered_map<std::string, std::string> mime_types = {
        {".txt", "text/plain"},
        {".html", "text/html"},
        {".htm", "text/html"},
        {".css", "text/css"},
        {".js", "application/javascript"},
        {".json", "application/json"},
        {".jpg", "image/jpeg"},
        {".jpeg", "image/jpeg"},
        {".png", "image/png"},
        {".gif", "image/gif"},
        {".pdf", "application/pdf"},
        {".zip", "application/zip"},
        {".tar", "application/x-tar"},
        {".gz", "application/gzip"},
        {".mp3", "audio/mpeg"},
        {".mp4", "video/mp4"},
        {".avi", "video/x-msvideo"},
        {".doc", "application/msword"},
        {".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
        {".xls", "application/vnd.ms-excel"},
        {".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
        {".ppt", "application/vnd.ms-powerpoint"},
        {".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"},
        {".odt", "application/vnd.oasis.opendocument.text"},
        {".ods", "application/vnd.oasis.opendocument.spreadsheet"},
        {".odp", "application/vnd.oasis.opendocument.presentation"},
        {".svg", "image/svg+xml"},
        {".xml", "application/xml"},
        {".csv", "text/csv"},
        {".rtf", "application/rtf"},
        {"", "application/octet-stream"},
        {".", "application/octet-stream"}
    };

    std::string ext = fs::path(filename).extension().string();
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
    
    auto it = mime_types.find(ext);
    return it != mime_types.end() ? it->second : "application/octet-stream";
}

std::string get_webdav_options_response() {
    return "HTTP/1.1 200 OK\r\n"
           "DAV: 1,2\r\n"
           "Allow: OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, MKCOL\r\n"
           "Content-Length: 0\r\n"
           "Connection: keep-alive\r\n\r\n";
}

std::string get_current_time() {
    auto now = std::time(nullptr);
    auto tm = *std::localtime(&now);
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%d %H:%M:%S");
    return oss.str();
}

std::string get_root_response(const WebDAVConfig& config) {
    std::ostringstream shares_list;
    for (const auto& share : config.shares) {
        shares_list << R"(
        <div class="share-card">
            <div class="share-icon">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M4 4h16v16H4V4zm2 2v12h12V6H6z"/>
                </svg>
            </div>
            <div class="share-details">
                <h3>)" << share.alias << R"(</h3>
                <p class="path">)" << share.path << R"(</p>
            </div>
            <div class="share-badge )" << (share.read_only ? "read-only" : "read-write") << R"(">
                )" << (share.read_only ? "Read Only" : "Read/Write") << R"(
            </div>
        </div>)";
    }

    std::time_t now = std::time(nullptr); 
    std::string html = R"(
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebDAV Server | NasPanel.site</title>
    <style>
        :root {
            --primary: #4361ee;
            --primary-light: #ebf2ff;
            --text: #2b2d42;
            --text-light: #8d99ae;
            --border: #edf2f4;
            --success: #4cc9f0;
            --warning: #f72585;
            --card-bg: #ffffff;
            --bg: #f8f9fa;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.5;
            background-color: var(--bg);
            color: var(--text);
            padding: 2rem;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: var(--card-bg);
            border-radius: 16px;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05);
            overflow: hidden;
            border: 1px solid var(--border);
        }
        
        header {
            padding: 2rem 2rem 1.5rem;
            border-bottom: 1px solid var(--border);
        }
        
        h1 {
            font-size: 1.8rem;
            font-weight: 600;
            color: var(--primary);
            margin-bottom: 0.5rem;
        }
        
        h2 {
            font-size: 1.3rem;
            margin: 1.5rem 0 1rem;
            color: var(--primary);
        }
        
        .subtitle {
            color: var(--text-light);
            font-size: 1rem;
        }
        
        .content {
            padding: 1.5rem 2rem;
        }
        
        .shares-container {
            margin-top: 1rem;
        }
        
        .share-card {
            display: flex;
            align-items: center;
            padding: 1.25rem;
            margin-bottom: 1rem;
            background: var(--card-bg);
            border-radius: 12px;
            border: 1px solid var(--border);
            transition: all 0.2s ease;
        }
        
        .share-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.05);
            border-color: var(--primary-light);
        }
        
        .share-icon {
            margin-right: 1.25rem;
            color: var(--primary);
        }
        
        .share-details {
            flex-grow: 1;
        }
        
        .share-details h3 {
            font-weight: 500;
            margin-bottom: 0.25rem;
        }
        
        .path {
            color: var(--text-light);
            font-size: 0.9rem;
            font-family: 'SF Mono', monospace;
            word-break: break-all;
        }
        
        .share-badge {
            padding: 0.35rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
        }
        
        .read-only {
            background-color: rgba(247, 37, 133, 0.1);
            color: var(--warning);
        }
        
        .read-write {
            background-color: rgba(76, 201, 240, 0.1);
            color: var(--success);
        }
        
        .connection-guide {
            background: var(--primary-light);
            padding: 1.5rem;
            border-radius: 12px;
            margin: 2rem 0;
        }
        
        .connection-method {
            margin-bottom: 1.5rem;
        }
        
        .connection-method h3 {
            font-size: 1.1rem;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .connection-method p {
            color: var(--text-light);
            font-size: 0.95rem;
        }
        
        .connection-method code {
            display: block;
            background: rgba(255,255,255,0.8);
            padding: 0.75rem;
            border-radius: 8px;
            margin-top: 0.5rem;
            font-family: 'SF Mono', monospace;
            font-size: 0.9rem;
            border: 1px solid rgba(67, 97, 238, 0.2);
        }
        
        .footer {
            padding: 1.5rem 2rem;
            text-align: center;
            color: var(--text-light);
            font-size: 0.85rem;
            border-top: 1px solid var(--border);
        }
        
        .copyright {
            margin-top: 0.5rem;
            font-size: 0.8rem;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 1rem;
            }
            
            header, .content {
                padding: 1.5rem;
            }
            
            .share-card {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .share-icon {
                margin-right: 0;
                margin-bottom: 1rem;
            }
            
            .share-badge {
                margin-top: 1rem;
                align-self: flex-end;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>WebDAV Server</h1>
            <p class="subtitle">Secure file access and sharing</p>
        </header>
        
        <div class="content">
            <div class="shares-container">
                <h2>Available Shares</h2>
                )" + shares_list.str() + R"(
            </div>
            
            <div class="connection-guide">
                <h2>How to Connect</h2>
                
                <div class="connection-method">
                    <h3>🖥️ Windows</h3>
                    <p>Map network drive:</p>
                    <code>\\your-server-ip@port\share-name</code>
                </div>
                
                <div class="connection-method">
                    <h3>🍎 macOS</h3>
                    <p>In Finder, select "Go" → "Connect to Server":</p>
                    <code>http://your-server-ip:port/share-name</code>
                </div>
                
                <div class="connection-method">
                    <h3>🐧 Linux</h3>
                    <p>Mount using davfs2:</p>
                    <code>sudo mount -t davfs http://your-server-ip:port/share-name /mnt/webdav</code>
                </div>
                
                <div class="connection-method">
                    <h3>📱 Mobile/Other</h3>
                    <p>Use WebDAV clients like:</p>
                    <code>Cyberduck, FileZilla, RaiDrive, Solid Explorer</code>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Server Time: )" + get_current_time() + R"( • WebDAV Ready</p>
            <p class="copyright">© )" + std::to_string(std::localtime(&now)->tm_year + 1900) + R"( NasPanel.site. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    )";

    std::ostringstream response;
    response << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: text/html\r\n"
             << "Content-Length: " << html.size() << "\r\n"
             << "Connection: keep-alive\r\n\r\n"
             << html;

    return response.str();
}

std::string generate_propfind_xml(const std::string& href, const fs::path& full_path) {
    std::ostringstream xml;
    bool is_dir = fs::is_directory(full_path);
    std::string display_name = full_path.filename().string();

    xml << "<d:response xmlns:d=\"DAV:\">\n"
        << "  <d:href>" << href << "</d:href>\n"
        << "  <d:propstat>\n"
        << "    <d:prop>\n"
        << "      <d:displayname>" << display_name << "</d:displayname>\n"
        << "      <d:resourcetype>"
        << (is_dir ? "<d:collection/>" : "")
        << "</d:resourcetype>\n";

    if (!is_dir) {
        xml << "      <d:getcontentlength>" << fs::file_size(full_path) << "</d:getcontentlength>\n"
            << "      <d:getcontenttype>" << get_mime_type(full_path.string()) << "</d:getcontenttype>\n";
    }

    xml << "    </d:prop>\n"
        << "    <d:status>HTTP/1.1 200 OK</d:status>\n"
        << "  </d:propstat>\n"
        << "</d:response>\n";

    return xml.str();
}

std::string get_webdav_propfind_response(const std::string& path, const WebDAVConfig& config) {
    std::ostringstream xml;
    xml << "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
        << "<d:multistatus xmlns:d=\"DAV:\">\n";

    try {
        std::string dav_path = path;
        if (dav_path.empty()) dav_path = "/";
        
        if (dav_path.back() != '/') {
            for (const auto& share : config.shares) {
                if (dav_path == "/" + share.alias) {
                    dav_path += "/";
                    break;
                }
                if (dav_path.find("/" + share.alias + "/") == 0) {
                    std::string relative_path = dav_path.substr(share.alias.length() + 2);
                    fs::path full_path = fs::path(share.path) / relative_path;
                    if (fs::is_directory(full_path)) {
                        dav_path += "/";
                    }
                    break;
                }
            }
        }

        if (dav_path == "/") {
            xml << generate_propfind_xml("/", fs::path("/"));

            for (const auto& share : config.shares) {
                xml << generate_propfind_xml("/" + share.alias + "/", fs::path(share.path));
            }
        } else {
            for (const auto& share : config.shares) {
                if (dav_path.find("/" + share.alias + "/") == 0 || dav_path == "/" + share.alias + "/") {
                    std::string relative_path = dav_path.substr(share.alias.length() + 2);
                    fs::path full_path = fs::path(share.path) / relative_path;

                    if (!fs::exists(full_path)) {
                        return "HTTP/1.1 404 Not Found\r\n\r\n";
                    }

                    xml << generate_propfind_xml(dav_path, full_path);

                    if (fs::is_directory(full_path)) {
                        for (const auto& entry : fs::directory_iterator(full_path)) {
                            std::string entry_name = entry.path().filename().string();
                            std::string entry_href = dav_path;
                            if (entry_href.back() != '/') entry_href += "/";
                            entry_href += entry_name;
                            if (entry.is_directory()) entry_href += "/";
                            xml << generate_propfind_xml(entry_href, entry.path());
                        }
                    }
                    break;
                }
            }
        }
    } catch (const fs::filesystem_error& e) {
        std::cerr << "Filesystem error: " << e.what() << std::endl;
        return "HTTP/1.1 500 Internal Server Error\r\n\r\n";
    }

    xml << "</d:multistatus>";

    std::ostringstream response;
    response << "HTTP/1.1 207 Multi-Status\r\n"
             << "Content-Type: application/xml; charset=\"utf-8\"\r\n"
             << "Content-Length: " << xml.str().length() << "\r\n"
             << "Connection: keep-alive\r\n\r\n"
             << xml.str();

    return response.str();
}

std::string handle_get_request(const std::string& request, const WebDAVConfig& config) {
    size_t start = request.find(' ') + 1;
    size_t end = request.find(' ', start);
    std::string path = request.substr(start, end - start);

    if (path == "/") {
        return get_root_response(config);
    }

    for (const auto& share : config.shares) {
        if (path.find("/" + share.alias) == 0) {
            std::string relative_path = path.substr(share.alias.length() + 1);
            fs::path full_path = fs::path(share.path) / relative_path;

            if (!fs::exists(full_path)) {
                return "HTTP/1.1 404 Not Found\r\n\r\n";
            }

            if (fs::is_directory(full_path)) {
                return get_webdav_propfind_response(path, config);
            }

            std::ifstream file(full_path, std::ios::binary);
            if (!file) {
                return "HTTP/1.1 403 Forbidden\r\n\r\n";
            }

            std::string content((std::istreambuf_iterator<char>(file)), 
                        std::istreambuf_iterator<char>());

            std::ostringstream response;
            response << "HTTP/1.1 200 OK\r\n"
                     << "Content-Type: " << get_mime_type(full_path.string()) << "\r\n"
                     << "Content-Length: " << content.size() << "\r\n"
                     << "Connection: keep-alive\r\n\r\n"
                     << content;

            return response.str();
        }
    }

    return "HTTP/1.1 404 Not Found\r\n\r\n";
}

std::string handle_put_request(const std::string& request, const WebDAVConfig& config) {
    size_t start = request.find(' ') + 1;
    size_t end = request.find(' ', start);
    std::string path = request.substr(start, end - start);

    for (const auto& share : config.shares) {
        if (path.find("/" + share.alias) == 0) {
            if (share.read_only) {
                return "HTTP/1.1 403 Forbidden\r\n\r\n";
            }

            std::string relative_path = path.substr(share.alias.length() + 1);
            fs::path full_path = fs::path(share.path) / relative_path;

            size_t header_end = request.find("\r\n\r\n");
            if (header_end == std::string::npos) {
                return "HTTP/1.1 400 Bad Request\r\n\r\n";
            }

            std::string content = request.substr(header_end + 4);

            fs::create_directories(full_path.parent_path());

            std::ofstream file(full_path, std::ios::binary);
            if (!file) {
                return "HTTP/1.1 500 Internal Server Error\r\n\r\n";
            }
            file.write(content.data(), content.size());

            return "HTTP/1.1 201 Created\r\n\r\n";
        }
    }
    return "HTTP/1.1 404 Not Found\r\n\r\n";
}

std::string handle_delete_request(const std::string& request, const WebDAVConfig& config) {
    size_t start = request.find(' ') + 1;
    size_t end = request.find(' ', start);
    std::string path = request.substr(start, end - start);

    for (const auto& share : config.shares) {
        if (path.find("/" + share.alias) == 0) {
            if (share.read_only) {
                return "HTTP/1.1 403 Forbidden\r\n\r\n";
            }

            std::string relative_path = path.substr(share.alias.length() + 1);
            fs::path full_path = fs::path(share.path) / relative_path;

            if (!fs::exists(full_path)) {
                return "HTTP/1.1 404 Not Found\r\n\r\n";
            }

            try {
                if (fs::is_directory(full_path)) {
                    fs::remove_all(full_path);
                } else {
                    fs::remove(full_path);
                }
                return "HTTP/1.1 204 No Content\r\n\r\n";
            } catch (...) {
                return "HTTP/1.1 500 Internal Server Error\r\n\r\n";
            }
        }
    }
    return "HTTP/1.1 404 Not Found\r\n\r\n";
}

std::string handle_mkcol_request(const std::string& request, const WebDAVConfig& config) {
    size_t start = request.find(' ') + 1;
    size_t end = request.find(' ', start);
    std::string path = request.substr(start, end - start);

    for (const auto& share : config.shares) {
        if (path.find("/" + share.alias) == 0) {
            if (share.read_only) {
                return "HTTP/1.1 403 Forbidden\r\n\r\n";
            }

            std::string relative_path = path.substr(share.alias.length() + 1);
            fs::path full_path = fs::path(share.path) / relative_path;

            if (fs::exists(full_path)) {
                return "HTTP/1.1 405 Method Not Allowed\r\n\r\n";
            }

            try {
                if (fs::create_directories(full_path)) {
                    return "HTTP/1.1 201 Created\r\n\r\n";
                } else {
                    return "HTTP/1.1 409 Conflict\r\n\r\n";
                }
            } catch (...) {
                return "HTTP/1.1 500 Internal Server Error\r\n\r\n";
            }
        }
    }
    return "HTTP/1.1 404 Not Found\r\n\r\n";
}

void handle_client(int client_fd, SharedConfig& shared_config) {
    char buffer[8192] = {0};
    ssize_t bytes_read = read(client_fd, buffer, sizeof(buffer) - 1);
    
    if (bytes_read <= 0) {
        close(client_fd);
        return;
    }

    std::string request(buffer, bytes_read);
    std::string response;

    std::cerr << "[" << get_current_time() << "] Request:\n" << request << "\n---\n";

    try {
        WebDAVConfig config;
        {
            std::lock_guard<std::mutex> lock(shared_config.mutex);
            config = shared_config.config;
        }

        if (request.find("OPTIONS ") == 0) {
            response = get_webdav_options_response();
        } 
        else if (request.find("PROPFIND ") == 0) {
            size_t start = request.find(' ') + 1;
            size_t end = request.find(' ', start);
            std::string path = request.substr(start, end - start);
            response = get_webdav_propfind_response(path, config);
        }
        else if (request.find("GET ") == 0) {
            response = handle_get_request(request, config);
        }
        else if (request.find("PUT ") == 0) {
            response = handle_put_request(request, config);
        }
        else if (request.find("DELETE ") == 0) {
            response = handle_delete_request(request, config);
        }
        else if (request.find("MKCOL ") == 0) {
            response = handle_mkcol_request(request, config);
        }
        else {
            response = "HTTP/1.1 501 Not Implemented\r\n\r\n";
        }
    } catch (const std::exception& e) {
        std::cerr << "[" << get_current_time() << "] Error handling request: " << e.what() << std::endl;
        response = "HTTP/1.1 500 Internal Server Error\r\n\r\n";
    }

    std::cerr << "[" << get_current_time() << "] Response:\n" << response << "\n---\n";

    send(client_fd, response.c_str(), response.size(), 0);
    close(client_fd);
}

void start_server(SharedConfig& shared_config) {
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        throw std::runtime_error("Socket creation failed");
    }

    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(shared_config.config.port);

    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) < 0) {
        close(server_fd);
        throw std::runtime_error("Bind failed");
    }

    if (listen(server_fd, 5) < 0) {
        close(server_fd);
        throw std::runtime_error("Listen failed");
    }

    std::cout << "[" << get_current_time() << "] Server started on port " 
              << shared_config.config.port << std::endl;

    while (true) {
        sockaddr_in client_addr{};
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(server_fd, (struct sockaddr*)&client_addr, &client_len);

        if (client_fd < 0) {
            std::cerr << "[" << get_current_time() << "] Accept error" << std::endl;
            continue;
        }

        handle_client(client_fd, shared_config);
    }
}

int main() {
    try {
        SharedConfig shared_config;
        shared_config.config = load_config("/etc/nas-panel/webdav.conf");
        
        setup_config_watcher(shared_config);
        start_server(shared_config);
    } catch (const std::exception& e) {
        std::cerr << "[" << get_current_time() << "] Error: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}