import type { TerraformConfig } from '../../types/terraform.types.js';

export function generateEC2Terraform(config: TerraformConfig): string {
  return `
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Get default VPC
data "aws_vpc" "default" {
  default = true
}

# Get default subnets
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security Group - Allow HTTP, HTTPS, and SSH
resource "aws_security_group" "app" {
  name        = "\${var.app_name}-sg"
  description = "Security group for \${var.app_name}"
  vpc_id      = data.aws_vpc.default.id

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Next.js default port
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH (optional, for debugging)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "\${var.app_name}-sg"
  }
}

# IAM Role for EC2 to pull from ECR
resource "aws_iam_role" "ec2_role" {
  name = "\${var.app_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

# Attach ECR read-only policy
resource "aws_iam_role_policy_attachment" "ecr_policy" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "\${var.app_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 Instance
resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.small"
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e
    
    # Update system
    yum update -y
    
    # Install Docker
    yum install -y docker
    systemctl start docker
    systemctl enable docker
    usermod -aG docker ec2-user
    
    # Install AWS CLI v2
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    yum install -y unzip
    unzip awscliv2.zip
    ./aws/install
    
    # Login to ECR
    aws ecr get-login-password --region ${config.region} | docker login --username AWS --password-stdin ${config.imageUri.split('/')[0]}
    
    # Pull and run Docker image
    docker pull ${config.imageUri}
    
    # Run container on port 3000
    docker run -d \
      --name ${config.appName} \
      --restart unless-stopped \
      -p 80:3000 \
      -e NODE_ENV=production \
      ${config.imageUri}
    
    echo "Application started successfully!"
  EOF
  )

  tags = {
    Name = var.app_name
  }

  # Wait for user_data to complete
  provisioner "local-exec" {
    command = "sleep 60"
  }
}

# Elastic IP for stable public address
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "\${var.app_name}-eip"
  }
}
`;
}

export function generateEC2Variables(config: TerraformConfig): string {
  return `
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "${config.region}"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "${config.appName}"
}

variable "image_uri" {
  description = "Docker image URI from ECR"
  type        = string
  default     = "${config.imageUri}"
}
`;
}

export function generateEC2Outputs(config: TerraformConfig): string {
  return `
# Main application URL
output "app_url" {
  description = "Application URL"
  value       = "http://\${aws_eip.app.public_ip}"
}

# Instance details
output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.app.id
}

# Public IP
output "public_ip" {
  description = "Public IP address"
  value       = aws_eip.app.public_ip
}

# AWS Region
output "region" {
  description = "AWS Region"
  value       = var.aws_region
}
`;
}

