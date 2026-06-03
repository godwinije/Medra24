module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr           = "10.1.0.0/16"
  public_subnet_cidrs = ["10.1.1.0/24", "10.1.2.0/24"]
  private_subnet_cidrs = ["10.1.10.0/24", "10.1.11.0/24"]
  availability_zones = ["us-east-1a", "us-east-1b"]
  project_name       = "omnihealth-staging"
}

module "eks" {
  source = "../../modules/eks"

  cluster_name    = "omnihealth-staging-cluster"
  subnet_ids      = module.vpc.private_subnet_ids
  node_group_name = "staging-nodes"
  desired_capacity = 2
  max_capacity     = 4
  min_capacity     = 2
  instance_type   = "t3.medium"
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "cluster_name" {
  value = module.eks.cluster_name
}
